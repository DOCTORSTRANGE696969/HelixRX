from flask import Flask, render_template, request, jsonify, send_file
from services.cpic_loader import load_cpic_data
from cpic_engine import initialize_cpic_engine
from services.vcf_parser import parse_vcf
from services.drug_gene_matcher import match_drug_with_vcf
from services.phenotype_engine import determine_phenotype
from services.response_builder import build_response_json, prepare_llm_prompt, format_response_for_json_output
from services.llm_service import get_llm_provider
from services.bigquery_logger import BigQueryLogger
import os
from dotenv import load_dotenv
from datetime import datetime
import json
import time
import uuid

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Set maximum file upload size to 5MB
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB in bytes

# Preserve JSON field order (Flask 3.0+ style)
app.json.sort_keys = False

# Load CPIC data at startup
try:
    CPIC_ENGINE = initialize_cpic_engine("data/cpic_gene-drug_pairs.xlsx")
except Exception as e:
    print(f"Fatal error: Could not load CPIC data - {e}")
    raise

# Initialize LLM provider (optional)
LLM_PROVIDER = None
try:
    api_key = os.getenv("GOOGLE_API_KEY")
    if api_key:
        LLM_PROVIDER = get_llm_provider("gemini", api_key)
        print("✓ Google Gemini API initialized")
    else:
        print("⚠ GOOGLE_API_KEY not found. LLM features disabled. Set GOOGLE_API_KEY environment variable to enable.")
except Exception as e:
    print(f"⚠ Warning: Could not initialize LLM provider - {e}")
    print("LLM features will be disabled. Set GOOGLE_API_KEY environment variable to enable.")

# Initialize BigQuery logger (optional, non-blocking)
BIGQUERY_LOGGER = None
try:
    enable_bq_logging = os.getenv("ENABLE_BIGQUERY_LOGGING", "false").lower() in ["1", "true", "yes"]
    if enable_bq_logging:
        BIGQUERY_LOGGER = BigQueryLogger(
            project_id=os.getenv("BIGQUERY_PROJECT_ID") or None,
            dataset_id=os.getenv("BIGQUERY_DATASET", "helixrx_analytics"),
            table_id=os.getenv("BIGQUERY_TABLE", "analysis_metadata"),
            auto_create=os.getenv("BIGQUERY_AUTO_CREATE", "false").lower() in ["1", "true", "yes"]
        )
        print("✓ BigQuery logging enabled")
    else:
        print("ℹ BigQuery logging disabled. Set ENABLE_BIGQUERY_LOGGING=true to enable.")
except Exception as e:
    print(f"⚠ Warning: Could not initialize BigQuery logger - {e}")
    print("BigQuery logging will be disabled.")


@app.route('/')
def landing():
    return render_template('landing.html')

@app.route('/console')
def console():
    return render_template('index.html')


@app.errorhandler(413)
def file_too_large(e):
    """Handle file size limit exceeded error."""
    return jsonify({
        "error": "File too large",
        "details": "The uploaded file exceeds the 5MB size limit. Please upload a smaller VCF file."
    }), 413


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Analyze VCF file and drugs for pharmacogenomic variants and phenotypes.
    """
    try:
        # Get uploaded VCF file
        if 'vcf_file' not in request.files:
            return render_template('index.html', error="No VCF file provided")
        
        vcf_file = request.files['vcf_file']
        if vcf_file.filename == '':
            return render_template('index.html', error="No VCF file selected")
        
        # Get drug input
        drugs_input = request.form.get('drugs', '')
        if not drugs_input:
            return render_template('index.html', error="No drugs provided")
        
        # Parse VCF file
        print("=" * 60)
        print("Starting VCF analysis...")
        vcf_data = parse_vcf(vcf_file)
        print(f"VCF parsing success: {vcf_data.get('vcf_parsing_success')}")
        
        # Check if VCF parsing was successful
        if not vcf_data.get('vcf_parsing_success'):
            error_msg = vcf_data.get('error', 'Unknown VCF parsing error')
            print(f"VCF parsing failed: {error_msg}")
            return render_template('index.html', error=f"VCF parsing error: {error_msg}")
        
        # Print parsed genes
        parsed_genes = list(vcf_data.get('variants', {}).keys())
        genes_with_variants = [g for g in parsed_genes if vcf_data['variants'][g]]
        print(f"Genes found in VCF: {genes_with_variants}")
        
        # Split drugs by comma and strip whitespace
        drug_list = [d.strip() for d in drugs_input.split(',') if d.strip()]
        print(f"Analyzing {len(drug_list)} drug(s): {drug_list}")
        
        # Build results
        results = []
        json_responses = []
        
        for drug in drug_list:
            print(f"\n--- Processing drug: {drug} ---")
            
            # Match drug with VCF data
            match_result = match_drug_with_vcf(drug, vcf_data, CPIC_ENGINE)
            print(f"Drug match result: {match_result}")
            
            # Check if drug is valid and gene found in VCF
            if match_result.get('valid') and match_result.get('gene_found_in_vcf'):
                gene = match_result.get('gene')
                variant_count = match_result.get('variant_count', 0)
                
                # Get variants for this gene
                gene_variants = vcf_data['variants'].get(gene, [])
                print(f"Found {variant_count} variant(s) for gene {gene}")
                
                # Determine phenotype
                phenotype_result = determine_phenotype(gene, gene_variants)
                print(f"Phenotype result: {phenotype_result}")
                
                # Build result entry
                result_entry = {
                    "drug": match_result.get('drug'),
                    "gene": gene,
                    "phenotype": phenotype_result.get('phenotype'),
                    "diplotype": phenotype_result.get('diplotype'),
                    "variant_count": variant_count,
                    "cpic_level": match_result.get('cpic_level')
                }
                results.append(result_entry)
                print(f"Added to results: {result_entry}")
                
                # Build structured JSON response
                json_response = build_response_json(
                    drug=match_result.get('drug'),
                    gene=gene,
                    phenotype=phenotype_result.get('phenotype'),
                    diplotype=phenotype_result.get('diplotype'),
                    variant_count=variant_count,
                    variants=gene_variants,
                    vcf_parsing_success=vcf_data.get('vcf_parsing_success'),
                    cpic_level=match_result.get('cpic_level'),
                    patient_id=vcf_data.get('patient_id')
                )
                json_responses.append(json_response)
                
                # Prepare LLM prompt (for future LLM integration)
                llm_prompt = prepare_llm_prompt(
                    drug=match_result.get('drug'),
                    gene=gene,
                    phenotype=phenotype_result.get('phenotype'),
                    diplotype=phenotype_result.get('diplotype'),
                    cpic_level=match_result.get('cpic_level'),
                    variants=gene_variants,
                    guideline_url=match_result.get('guideline_url'),
                    risk_assessment=json_response.get('risk_assessment') if json_response else None
                )
                print(f"LLM Prompt prepared for {drug}")
                
                print(f"JSON Response: {json_response}")
            
            elif match_result.get('valid'):
                # Drug is valid but gene not found in VCF
                print(f"Drug {drug} is valid but no variants found in VCF")
                result_entry = {
                    "drug": match_result.get('drug'),
                    "gene": match_result.get('gene'),
                    "phenotype": "Not available in VCF",
                    "diplotype": None,
                    "variant_count": 0,
                    "cpic_level": match_result.get('cpic_level')
                }
                results.append(result_entry)
            
            else:
                # Drug not valid
                print(f"Drug {drug} not valid: {match_result.get('error')}")
                result_entry = {
                    "drug": match_result.get('drug'),
                    "error": match_result.get('error'),
                    "phenotype": "Error"
                }
                results.append(result_entry)
        
        print(f"\n{'=' * 60}")
        print(f"Analysis complete. Total results: {len(results)}")
        print(f"Total JSON responses: {len(json_responses)}")
        
        # Print all JSON responses
        for i, json_resp in enumerate(json_responses, 1):
            print(f"\nJSON Response {i}:")
            print(format_response_for_json_output(json_resp))
        
        # Pass results to template
        return render_template('index.html', results=results, vcf_parsed=True, json_responses=json_responses)
    
    except Exception as e:
        print(f"Unexpected error in /analyze: {str(e)}")
        return render_template('index.html', error=f"Analysis error: {str(e)}")


@app.route('/api/analysis', methods=['POST'])
def api_analysis():
    """
    API endpoint that returns structured JSON responses for VCF analysis.
    This endpoint is designed for programmatic access and LLM integration.
    """
    request_started_at = time.time()
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())

    def log_api_metadata(status, http_status, error_message=None, analyses=None, patient_id=None, drugs=None, request_metadata=None):
        if not BIGQUERY_LOGGER:
            return

        try:
            duration_ms = int((time.time() - request_started_at) * 1000)
            response_metadata = {}
            if analyses:
                response_metadata = {
                    "cpic_levels": sorted(list({a.get("cpic_evidence_level") for a in analyses if a.get("cpic_evidence_level")})),
                    "risk_labels": sorted(list({a.get("risk_assessment", {}).get("risk_label") for a in analyses if a.get("risk_assessment", {}).get("risk_label")})),
                    "drugs_processed": [a.get("drug") for a in analyses if a.get("drug")]
                }

            BIGQUERY_LOGGER.log_analysis_event({
                "event_id": str(uuid.uuid4()),
                "request_id": request_id,
                "endpoint": "/api/analysis",
                "status": status,
                "http_status": http_status,
                "error_message": error_message,
                "duration_ms": duration_ms,
                "client_ip": request.headers.get("X-Forwarded-For", request.remote_addr),
                "user_agent": request.headers.get("User-Agent"),
                "patient_id": patient_id,
                "drugs": ",".join(drugs) if drugs else None,
                "analysis_count": len(analyses) if analyses else 0,
                "llm_enabled": bool(LLM_PROVIDER),
                "llm_provider": "gemini",
                "request_metadata": request_metadata or {},
                "response_metadata": response_metadata,
            })
        except Exception as e:
            # Logging should never block API responses.
            print(f"⚠ BigQuery logging error: {e}")

    try:
        # Get uploaded VCF file
        if 'vcf_file' not in request.files:
            log_api_metadata(
                status="validation_error",
                http_status=400,
                error_message="No VCF file provided"
            )
            return jsonify({"error": "No VCF file provided"}), 400
        
        vcf_file = request.files['vcf_file']
        if vcf_file.filename == '':
            log_api_metadata(
                status="validation_error",
                http_status=400,
                error_message="No VCF file selected"
            )
            return jsonify({"error": "No VCF file selected"}), 400
        
        # Get drug input
        drugs_input = request.form.get('drugs', '')
        if not drugs_input:
            log_api_metadata(
                status="validation_error",
                http_status=400,
                error_message="No drugs provided",
                request_metadata={"filename": vcf_file.filename}
            )
            return jsonify({"error": "No drugs provided"}), 400
        
        # Parse VCF file
        vcf_data = parse_vcf(vcf_file)
        print(f"VCF Parse Result: {vcf_data.get('vcf_parsing_success')}")
        
        if not vcf_data.get('vcf_parsing_success'):
            log_api_metadata(
                status="parse_error",
                http_status=400,
                error_message=vcf_data.get('error', 'Unknown error'),
                request_metadata={
                    "filename": vcf_file.filename,
                    "drugs_input": drugs_input
                }
            )
            return jsonify({
                "error": "VCF parsing failed",
                "details": vcf_data.get('error', 'Unknown error')
            }), 400
        
        # Split drugs by comma
        drug_list = [d.strip() for d in drugs_input.split(',') if d.strip()]
        print(f"Drug list to analyze: {drug_list}")
        print(f"CPIC_ENGINE keys: {list(CPIC_ENGINE.keys())}")
        print(f"VCF variants keys: {list(vcf_data.get('variants', {}).keys())}")
        
        # Build JSON responses
        json_responses = []
        
        for drug in drug_list:
            print(f"\n--- Processing drug: {drug} ---")
            print(f"Drug in CPIC_ENGINE: {drug in CPIC_ENGINE}")
            if drug in CPIC_ENGINE:
                print(f"CPIC data for {drug}: {CPIC_ENGINE[drug]}")
            
            # Match drug with VCF data
            match_result = match_drug_with_vcf(drug, vcf_data, CPIC_ENGINE)
            print(f"Match result: {match_result}")
            print(f"  - valid: {match_result.get('valid')}")
            print(f"  - gene: {match_result.get('gene')}")
            print(f"  - gene_found_in_vcf: {match_result.get('gene_found_in_vcf')}")
            print(f"  - variant_count: {match_result.get('variant_count')}")
            
            if match_result.get('valid') and match_result.get('gene_found_in_vcf'):
                gene = match_result.get('gene')
                
                # Get variants for this gene
                gene_variants = vcf_data['variants'].get(gene, [])
                print(f"Gene variants: {gene_variants}")
                
                # Determine phenotype
                phenotype_result = determine_phenotype(gene, gene_variants)
                print(f"Phenotype: {phenotype_result}")
                
                # Generate clinical recommendation using LLM
                llm_result = None
                if LLM_PROVIDER:
                    try:
                        print(f"Calling Gemini API for {drug}...")
                        llm_prompt = prepare_llm_prompt(
                            drug=match_result.get('drug'),
                            gene=gene,
                            phenotype=phenotype_result.get('phenotype'),
                            diplotype=phenotype_result.get('diplotype'),
                            cpic_level=match_result.get('cpic_level'),
                            variants=gene_variants,
                            guideline_url=match_result.get('guideline_url'),
                            risk_assessment=None
                        )
                        llm_result = LLM_PROVIDER.generate_clinical_recommendation(llm_prompt)
                        print(f"LLM response: {llm_result}")
                    except Exception as e:
                        print(f"⚠ LLM API error: {e}")
                        llm_result = None
                
                # Build structured JSON response
                json_response = build_response_json(
                    drug=match_result.get('drug'),
                    gene=gene,
                    phenotype=phenotype_result.get('phenotype'),
                    diplotype=phenotype_result.get('diplotype'),
                    variant_count=match_result.get('variant_count', 0),
                    variants=gene_variants,
                    vcf_parsing_success=vcf_data.get('vcf_parsing_success'),
                    cpic_level=match_result.get('cpic_level'),
                    patient_id=vcf_data.get('patient_id'),
                    clinical_recommendation=llm_result.get('clinical_recommendation') if llm_result else None,
                    llm_explanation=llm_result.get('llm_generated_explanation') if llm_result else None,
                    guideline_url=match_result.get('guideline_url')
                )
                json_responses.append(json_response)
                print(f"Added response for {drug}")
            
            elif match_result.get('gemini_fallback'):
                # Drug not in CPIC - use Gemini for full analysis
                print(f"Using Gemini fallback for {drug}")
                
                # All available variants from VCF
                all_variants = []
                for gene_variants_list in vcf_data['variants'].values():
                    if isinstance(gene_variants_list, list):
                        all_variants.extend(gene_variants_list)
                
                # Build patient-friendly Gemini prompt for drug not in CPIC
                gemini_prompt = f"""You are a healthcare expert explaining medication genetics to a patient in simple, easy-to-understand language.

PATIENT'S GENETIC PROFILE FOR: {match_result.get('drug')}
Patient's identified genes and genetic markers: {', '.join(list(vcf_data.get('variants', {}).keys())) or 'Multiple genes detected'}
Total genetic variants found: {len(all_variants)}

IMPORTANT: This medication is not in our standard database, but we can still analyze it using the patient's genetic profile.

For alternative drugs: List SPECIFIC drugs and explain WHY each would be better for this patient's genetic profile.

Please provide information in this JSON format, using simple language that a patient can understand:
{{
  "clinical_recommendation": {{
    "dosage_adjustment": "In simple terms, whether the patient should take more, less, or standard amounts based on their genetics",
    "monitoring": "What the patient and their doctor should watch for or check regularly",
    "alternative_drugs": [
      {{
        "drug_name": "NAME",
        "reason": "Why this drug is better for this patient's genetics",
        "why_suitable": "How this drug works with this patient's genetic profile"
      }}
    ],
    "urgency": "routine|important|urgent - how urgent to discuss with doctor"
  }},
  "llm_generated_explanation": {{
    "summary": "A simple 1-2 sentence explanation of how the patient's genetics might affect {match_result.get('drug')}",
    "mechanism": "In plain English, how the patient's genetic profile affects how their body processes {match_result.get('drug')}",
    "interaction_notes": ["Important practical tips about taking {match_result.get('drug')}", "What to discuss with their doctor"],
    "evidence_basis": "How confident we are in this information based on the genetic variants found"
  }}
}}

Remember: Write for a patient with no medical background. Be supportive, encouraging, and clear. Explain WHY alternatives are recommended."""
                
                llm_result = None
                if LLM_PROVIDER:
                    try:
                        print(f"Calling Gemini API with fallback for {drug}...")
                        llm_result = LLM_PROVIDER.generate_clinical_recommendation(gemini_prompt)
                        print(f"LLM fallback response: {llm_result}")
                    except Exception as e:
                        print(f"⚠ LLM fallback error: {e}")
                        llm_result = None
                
                # Build response with Gemini data
                json_response = build_response_json(
                    drug=match_result.get('drug'),
                    gene="Unknown (Gemini analysis)",
                    phenotype="Analysis by Gemini",
                    diplotype=None,
                    variant_count=len(all_variants),
                    variants=all_variants,
                    vcf_parsing_success=vcf_data.get('vcf_parsing_success'),
                    cpic_level="Custom",
                    patient_id=vcf_data.get('patient_id'),
                    clinical_recommendation=llm_result.get('clinical_recommendation') if llm_result else None,
                    llm_explanation=llm_result.get('llm_generated_explanation') if llm_result else None,
                    guideline_url=match_result.get('guideline_url')
                )
                json_responses.append(json_response)
                print(f"Added Gemini fallback response for {drug}")
            
            else:
                # Drug not valid
                print(f"Drug {drug} not valid: {match_result.get('error')}")
        
        print(f"\nTotal responses: {len(json_responses)}")
        
        response_payload = {
            "total_analyses": len(json_responses),
            "analyses": json_responses
        }

        log_api_metadata(
            status="success",
            http_status=200,
            analyses=json_responses,
            patient_id=vcf_data.get('patient_id'),
            drugs=drug_list,
            request_metadata={
                "filename": vcf_file.filename,
                "drugs_input": drugs_input,
                "variant_gene_count": len(vcf_data.get('variants', {})),
                "vcf_parsing_success": bool(vcf_data.get('vcf_parsing_success'))
            }
        )

        return jsonify(response_payload), 200
    
    except Exception as e:
        print(f"Unexpected error in /api/analysis: {str(e)}")
        import traceback
        traceback.print_exc()
        log_api_metadata(
            status="server_error",
            http_status=500,
            error_message=str(e)
        )
        return jsonify({
            "error": "Analysis error",
            "details": str(e)
        }), 500


@app.route('/generate-report', methods=['POST'])
def generate_report():
    """
    Generate a comprehensive HTML report from analysis results.
    Expects JSON data with analyses array.
    """
    try:
        data = request.get_json()
        
        if not data or 'analyses' not in data:
            return jsonify({"error": "No analysis data provided"}), 400
        
        analyses = data.get('analyses', [])
        patient_id = data.get('patient_id', 'UNKNOWN')
        
        if not analyses:
            return jsonify({"error": "No analyses provided"}), 400
        
        # Get current timestamp
        timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")
        analysis_date = datetime.now().strftime("%B %d, %Y")
        
        # Render the report template
        report_html = render_template(
            'report.html',
            analyses=analyses,
            patient_id=patient_id,
            timestamp=timestamp,
            analysis_date=analysis_date
        )
        
        return report_html, 200, {'Content-Type': 'text/html'}
    
    except Exception as e:
        print(f"Error generating report: {str(e)}")
        return jsonify({
            "error": "Report generation error",
            "details": str(e)
        }), 500


if __name__ == '__main__':
    app.run(debug=False)