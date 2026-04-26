import json
from datetime import datetime
import uuid
from .alternatives_engine import build_alternatives_list


def build_response_json(
    drug: str,
    gene: str,
    phenotype: str,
    diplotype: str,
    variant_count: int,
    variants: list,
    vcf_parsing_success: bool,
    cpic_level: str = None,
    patient_id: str = None,
    clinical_recommendation: dict = None,
    llm_explanation: dict = None,
    guideline_url: str = None
) -> dict:
    """
    Build the structured JSON response matching the required schema.
    
    Parameters:
    -----------
    drug : str
        Drug name (uppercase)
    gene : str
        Primary gene symbol
    phenotype : str
        Metabolic phenotype (PM, IM, NM, RM, URM, Unknown)
    diplotype : str
        Diplotype string (e.g., "*1/*4")
    variant_count : int
        Number of detected variants
    variants : list
        List of variant dictionaries with rsid, star, etc.
    vcf_parsing_success : bool
        Whether VCF parsing was successful
    cpic_level : str
        CPIC evidence level (A, B, C)
    patient_id : str
        Patient ID (auto-generated if not provided)
    clinical_recommendation : dict
        Clinical recommendation from LLM
    llm_explanation : dict
        LLM-generated explanation
    guideline_url : str
        Link to clinical guideline for this drug
        
    Returns:
    --------
    dict
        Structured JSON matching the required schema
    """
    
    # Generate patient ID if not provided
    if not patient_id:
        patient_id = f"PATIENT_{uuid.uuid4().hex[:8].upper()}"
    
    # Get current timestamp in ISO8601 format
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # Determine risk assessment based on phenotype
    risk_assessment = _determine_risk_assessment(phenotype, cpic_level, drug)
    
    # Build pharmacogenomic profile
    pharmacogenomic_profile = {
        "primary_gene": gene,
        "diplotype": diplotype,
        "phenotype": phenotype,
        "detected_variants": variants if variants else []
    }
    
    # Build quality metrics
    quality_metrics = {
        "vcf_parsing_success": vcf_parsing_success,
        "variant_count": variant_count,
        "data_completeness": "high" if variant_count > 0 else "low"
    }
    
    # Prepare clinical recommendation with enhanced alternatives
    final_clinical_recommendation = clinical_recommendation or {
        "dosage_adjustment": "Pending LLM analysis",
        "monitoring": "Standard monitoring recommended",
        "alternative_drugs": [],
        "urgency": "routine"
    }
    
    # Enhance alternatives with reasoning if not already detailed
    if final_clinical_recommendation and "alternative_drugs" in final_clinical_recommendation:
        existing_alts = final_clinical_recommendation.get("alternative_drugs", [])
        # If alternatives are just strings, keep as-is (LLM provided structured response)
        # If alternatives are empty or simple, add detailed alternatives with reasoning
        if isinstance(existing_alts, list) and (len(existing_alts) == 0 or all(isinstance(a, str) for a in existing_alts)):
            detailed_alternatives = build_alternatives_list(drug, phenotype, risk_assessment.get("risk_label", "Unknown"))
            if detailed_alternatives:
                final_clinical_recommendation["alternative_drugs"] = detailed_alternatives
    
    # Build main response in exact field order as required by schema
    response = {
        "patient_id": patient_id,
        "drug": drug,
        "timestamp": timestamp,
        "risk_assessment": risk_assessment,
        "pharmacogenomic_profile": pharmacogenomic_profile,
        "clinical_recommendation": final_clinical_recommendation,
        "llm_generated_explanation": llm_explanation or {
            "summary": "Awaiting LLM analysis",
            "mechanism": "Not available",
            "interaction_notes": [],
            "evidence_basis": "Pending"
        },
        "quality_metrics": quality_metrics,
        "cpic_evidence_level": cpic_level or "N/A"
    }
    
    # Add guideline_url at end if available (optional field)
    if guideline_url:
        response["guideline_url"] = guideline_url
    
    return response


def _determine_risk_assessment(phenotype: str, cpic_level: str = None, drug: str = None) -> dict:
    """
    Determine risk assessment based on phenotype and CPIC level.
    
    Parameters:
    -----------
    phenotype : str
        Metabolic phenotype
    cpic_level : str
        CPIC evidence level
    drug : str
        Drug name (optional, for context)
        
    Returns:
    --------
    dict
        Risk assessment with risk_label, confidence_score, severity
    """
    
    # Risk mapping based on phenotype
    phenotype_risk_map = {
        "PM": {"label": "Toxic", "severity": "critical", "confidence": 0.95},
        "IM": {"label": "Adjust Dosage", "severity": "moderate", "confidence": 0.85},
        "NM": {"label": "Safe", "severity": "none", "confidence": 0.90},
        "RM": {"label": "Adjust Dosage", "severity": "low", "confidence": 0.80},
        "URM": {"label": "Ineffective", "severity": "high", "confidence": 0.85},
        "Unknown": {"label": "Unable to determine", "severity": "low", "confidence": 0.60},
        "No variants detected": {"label": "No variants detected in VCF", "severity": "low", "confidence": 0.30}
    }
    
    # Get default risk
    risk_data = phenotype_risk_map.get(phenotype, phenotype_risk_map["Unknown"])
    
    # Adjust confidence based on CPIC level
    confidence = risk_data["confidence"]
    if cpic_level == "A":
        confidence = min(0.99, confidence + 0.05)
    elif cpic_level == "B":
        confidence = min(0.95, confidence + 0.03)
    elif cpic_level == "C":
        confidence = max(0.70, confidence - 0.10)
    
    return {
        "risk_label": risk_data["label"],
        "confidence_score": round(confidence, 2),
        "severity": risk_data["severity"]
    }


def prepare_llm_prompt(
    drug: str,
    gene: str,
    phenotype: str,
    diplotype: str,
    cpic_level: str = None,
    variant_count: int = 0,
    guideline_url: str = None,
    risk_assessment: dict = None
) -> str:
    """
    Prepare a structured prompt for LLM API to generate patient-friendly clinical recommendations.
    
    Parameters:
    -----------
    drug : str
        Drug name
    gene : str
        Gene symbol
    phenotype : str
        Metabolic phenotype
    diplotype : str
        Diplotype
    cpic_level : str
        CPIC evidence level
    variant_count : int
        Number of detected variants
        
    Returns:
    --------
    str
        Formatted prompt for LLM with patient-friendly language
    """
    
    phenotype_explanation = {
        "PM": "Poor Metabolizer (your body breaks down this drug slowly)",
        "IM": "Intermediate Metabolizer (your body breaks down this drug at a moderate pace)",
        "NM": "Normal Metabolizer (your body breaks down this drug at a normal pace)",
        "RM": "Rapid Metabolizer (your body breaks down this drug quickly)",
        "URM": "Ultra-Rapid Metabolizer (your body breaks down this drug very quickly)",
        "Unknown": "Unknown Metabolizer status"
    }
    
    phenotype_desc = phenotype_explanation.get(phenotype, phenotype)
    
    risk_label = None
    risk_severity = None
    if isinstance(risk_assessment, dict):
        risk_label = risk_assessment.get("risk_label")
        risk_severity = risk_assessment.get("severity")

    prompt = f"""You are a healthcare expert explaining medication genetics to a patient in simple, easy-to-understand language.
Your response MUST align with CPIC guidelines and be clinically actionable.

PATIENT'S GENETIC PROFILE:
- Medication: {drug}
- Gene involved: {gene} (this gene controls how your body processes {drug})
- Your metabolism type: {phenotype_desc}
- Your genetic combination: {diplotype}
- Science confidence: {cpic_level or 'Standard'} level evidence
- Genetic markers found: {variant_count} identified
- Risk assessment: {risk_label or 'Unknown'} (severity: {risk_severity or 'unknown'})
- CPIC guideline link (use if available): {guideline_url or 'Not available'}

IMPORTANT:
- Follow CPIC guidance for this drug-gene pair. Do not contradict CPIC recommendations.
- Provide personalized pharmacogenomic risks based on phenotype and diplotype.
- For alternative drugs: List SPECIFIC drugs and explain WHY each is suitable for this patient's genotype.
- For dosing: Be specific (e.g., "Reduce dose by 50%", "Take at normal dose", "Consider dose increase").
- Provide monitoring guidance (e.g., "Monitor INR levels", "Watch for adverse effects").
- Use simple language, avoid medical jargon, and be encouraging.
- Output MUST be valid JSON only (no markdown, no extra text).

Please provide information in this JSON format:
{{
  "clinical_recommendation": {{
    "dosage_adjustment": "Specific guidance on dosing adjustment for this patient's metabolism type and risk level",
    "monitoring": "Specific advice on what this patient and their doctor should monitor regularly",
    "alternative_drugs": [
      {{
        "drug_name": "DRUGNAME",
        "reason": "Why this drug is better for this patient's specific genotype/phenotype",
        "why_suitable": "How this drug bypasses or minimizes the genetic issue"
      }}
    ],
    "urgency": "routine|important|urgent - based on risk level"
  }},
  "llm_generated_explanation": {{
    "summary": "1-2 sentences explaining what the genetic findings mean for {drug} specifically",
    "mechanism": "Plain English explanation of HOW the genetic variants affect {drug} metabolism in this patient",
    "interaction_notes": [
      "Specific practical tips about taking {drug}",
      "What to tell the pharmacist about these genetic findings",
      "When to contact the doctor (side effects, effectiveness)"
    ],
    "evidence_basis": "Confidence level based on CPIC evidence (cite: 'CPIC Level {cpic_level or 'N/A'}'). Mention how common this genetic variant is."
  }}
}}

Remember: Write for a patient who has no medical background. Use 'you' and 'your'. Be supportive and clear."""
    
    return prompt


def format_response_for_json_output(response_dict: dict) -> str:
    """
    Format the response dictionary as pretty JSON string.
    
    Parameters:
    -----------
    response_dict : dict
        The response dictionary
        
    Returns:
    --------
    str
        Formatted JSON string
    """
    return json.dumps(response_dict, indent=2)
