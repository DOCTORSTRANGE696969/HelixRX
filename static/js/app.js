// HelixRx Pro Terminal - Frontend Application
// Complete UI logic with backend integration

// ===========================
// State Management
// ===========================
const appState = {
    vcfFile: null,
    selectedDrugs: new Set(),
    analysisData: null,
    patientId: null
};

let helixLoaderOverlay = null;

// ===========================
// DOM Elements
// ===========================
const elements = {
    // File Upload
    dropzone: document.getElementById('dropzone'),
    vcfFileInput: document.getElementById('vcf-file-input'),
    vcfError: document.getElementById('vcf-error'),
    vcfSuccess: document.getElementById('vcf-success'),
    
    // Drug Selector
    drugSelectorBox: document.getElementById('drug-selector-box'),
    selectedDrugsContainer: document.getElementById('selected-drugs'),
    drugInput: document.getElementById('drug-input'),
    drugDropdown: document.getElementById('drug-dropdown'),
    drugOptions: document.querySelectorAll('.drug-option'),
    clearAll: document.getElementById('clear-all'),
    drugError: document.getElementById('drug-error'),
    
    // Analysis Button
    runButton: document.getElementById('run-analysis-btn'),
    
    // Results
    resultsContainer: document.getElementById('results-container'),
    analysisDrugSelect: document.getElementById('analysis-drug-select'),
    downloadReportBtn: document.getElementById('download-report-btn'),
    genomicToggle: document.getElementById('toggle-genomic'),
    clinicalToggle: document.getElementById('toggle-clinical'),
    genomicView: document.getElementById('genomic-view'),
    clinicalView: document.getElementById('clinical-view'),
    clinicalRisk: document.getElementById('clinical-risk'),
    clinicalRiskDetail: document.getElementById('clinical-risk-detail'),
    clinicalUrgency: document.getElementById('clinical-urgency'),
    clinicalDosage: document.getElementById('clinical-dosage'),
    clinicalMonitoring: document.getElementById('clinical-monitoring'),
    riskStatus: document.getElementById('risk-status'),
    severityBadge: document.getElementById('severity-badge'),
    severityScore: document.getElementById('severity-score'),
    severityLevel: document.getElementById('severity-level'),
    gaugeArc: document.getElementById('gauge-arc'),
    detectedVariant: document.getElementById('detected-variant'),
    predictedPhenotype: document.getElementById('predicted-phenotype'),
    
    // Tabs
    tabButtons: document.querySelectorAll('.tab-button'),
    tabProfile: document.getElementById('tab-profile'),
    tabRecommendation: document.getElementById('tab-recommendation'),
    tabExplanation: document.getElementById('tab-explanation'),
    metadataText: document.getElementById('metadata-text'),
    guidelineLink: document.getElementById('guideline-link'),
    recommendationContent: document.getElementById('recommendation-content'),
    explanationContent: document.getElementById('explanation-content'),
    
    // Trust Badges
    cpicLevelBadge: document.getElementById('cpic-level-badge'),
    guidelineUpdated: document.getElementById('guideline-updated'),
    trustBadges: document.getElementById('trust-badges'),
    
    // JSON Export
    jsonPanel: document.getElementById('json-panel'),
    jsonOutput: document.getElementById('json-output'),
    copyJson: document.getElementById('copy-json'),
    downloadJson: document.getElementById('download-json'),
    refreshJson: document.getElementById('refresh-json'),
    
    // Progress
    progressPercent: document.getElementById('progress-percent'),
    sessionId: document.getElementById('session-id')
};

// ===========================
// File Upload Logic
// ===========================
function initFileUpload() {
    // Click to browse
    elements.dropzone.addEventListener('click', (e) => {
        if (e.target.id !== 'vcf-file-input') {
            elements.vcfFileInput.click();
        }
    });
    
    // File input change
    elements.vcfFileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    elements.dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropzone.classList.add('border-blue-400', 'bg-blue-50');
    });
    
    elements.dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove('border-blue-400', 'bg-blue-50');
    });
    
    elements.dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropzone.classList.remove('border-blue-400', 'bg-blue-50');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Reset errors
    elements.vcfError.classList.add('hidden');
    elements.vcfSuccess.classList.add('hidden');
    
    // Hide download report button when new file is selected
    if (elements.downloadReportBtn) {
        elements.downloadReportBtn.classList.add('hidden');
    }
    
    // Reset analysis data
    appState.analysisData = null;
    appState.patientId = null;
    
    // Validate file type
    if (!file.name.endsWith('.vcf')) {
        showVcfError();
        appState.vcfFile = null;
        return;
    }
    
    // Store file
    appState.vcfFile = file;
    
    // Update UI
    showVcfSuccess(file.name);
}

function showVcfError() {
    elements.dropzone.classList.add('border-red-300', 'bg-red-50');
    elements.dropzone.classList.remove('border-gray-300', 'bg-gray-50');
    elements.vcfError.classList.remove('hidden');
}

function showVcfSuccess(filename) {
    elements.dropzone.classList.remove('border-red-300', 'bg-red-50', 'border-gray-300');
    elements.dropzone.classList.add('border-green-300', 'bg-green-50');
    elements.vcfSuccess.classList.remove('hidden');
    elements.vcfSuccess.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${filename} loaded successfully`;
}

// ===========================
// Drug Selector Logic
// ===========================
function initDrugSelector() {
    const allDrugs = Array.from(elements.drugOptions).map(option => option.dataset.drug);

    // Open dropdown
    elements.drugSelectorBox.addEventListener('click', () => {
        elements.drugDropdown.classList.remove('hidden');
        elements.drugInput.focus();
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!elements.drugSelectorBox.contains(e.target) && !elements.drugDropdown.contains(e.target)) {
            elements.drugDropdown.classList.add('hidden');
        }
    });
    
    // Drug option selection
    elements.drugOptions.forEach(option => {
        option.addEventListener('click', () => {
            const drug = option.dataset.drug;
            toggleDrug(drug);
            elements.drugInput.value = '';
            updateDropdownFilter(allDrugs, '');
        });
    });

    // Typing/filtering
    elements.drugInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        elements.drugDropdown.classList.remove('hidden');
        updateDropdownFilter(allDrugs, query);
    });

    elements.drugInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const typed = elements.drugInput.value.trim();
            if (!typed) {
                return;
            }
            const match = allDrugs.find(drug => drug.toLowerCase() === typed.toLowerCase());
            if (match) {
                toggleDrug(match);
                elements.drugInput.value = '';
                updateDropdownFilter(allDrugs, '');
            } else {
                const customDrug = typed.toUpperCase();
                toggleDrug(customDrug);
                elements.drugInput.value = '';
                updateDropdownFilter(allDrugs, '');
            }
        }
        if (e.key === 'Backspace' && !elements.drugInput.value) {
            const last = Array.from(appState.selectedDrugs).pop();
            if (last) {
                appState.selectedDrugs.delete(last);
                updateDrugDisplay();
            }
        }
    });
    
    // Clear all
    elements.clearAll.addEventListener('click', (e) => {
        e.stopPropagation();
        appState.selectedDrugs.clear();
        updateDrugDisplay();
    });
}

function toggleDrug(drug) {
    if (appState.selectedDrugs.has(drug)) {
        appState.selectedDrugs.delete(drug);
    } else {
        appState.selectedDrugs.add(drug);
    }
    updateDrugDisplay();
}

function updateDrugDisplay() {
    // Clear container but keep the input
    elements.selectedDrugsContainer.innerHTML = '';
    
    // Add drug tags
    if (appState.selectedDrugs.size === 0) {
        elements.clearAll.classList.add('hidden');
    } else {
        appState.selectedDrugs.forEach(drug => {
            const tag = createDrugTag(drug);
            elements.selectedDrugsContainer.appendChild(tag);
        });
        elements.clearAll.classList.remove('hidden');
    }

    elements.selectedDrugsContainer.appendChild(elements.drugInput);
    elements.drugInput.placeholder = appState.selectedDrugs.size === 0 ? 'Type drug name...' : '';
    
    // Hide error if drugs are selected
    if (appState.selectedDrugs.size > 0) {
        elements.drugError.classList.add('hidden');
    }
}

function updateDropdownFilter(allDrugs, query) {
    const normalized = query.toLowerCase();
    elements.drugOptions.forEach(option => {
        const drug = option.dataset.drug;
        const matches = drug.toLowerCase().includes(normalized);
        option.classList.toggle('hidden', !matches);
    });
}

function createDrugTag(drug) {
    const tag = document.createElement('div');
    tag.className = 'bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-1 rounded flex items-center gap-1.5';
    tag.innerHTML = `
        <span>${drug}</span>
        <i class="fa-solid fa-xmark cursor-pointer hover:text-blue-900"></i>
    `;
    
    // Remove tag on click
    tag.querySelector('i').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDrug(drug);
    });
    
    return tag;
}

// ===========================
// Analysis Execution
// ===========================
function initAnalysis() {
    elements.runButton.addEventListener('click', async () => {
        // Validate inputs
        if (!validateInputs()) {
            return;
        }
        
        // Show loading state
        setLoadingState(true);
        
        try {
            // Prepare form data
            const formData = new FormData();
            formData.append('vcf_file', appState.vcfFile);
            formData.append('drugs', Array.from(appState.selectedDrugs).join(','));
            
            // Call API
            const response = await fetch('/api/analysis', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Store analysis data
                appState.analysisData = data;
                
                // Display results
                displayResults(data);
                
                // Update progress
                updateProgress(100);
            } else {
                showError(data.error || 'Analysis failed');
            }
        } catch (error) {
            console.error('Analysis error:', error);
            showError('Network error. Please try again.');
        } finally {
            setLoadingState(false);
        }
    });
}

function validateInputs() {
    let isValid = true;
    
    // Check VCF file
    if (!appState.vcfFile) {
        showVcfError();
        isValid = false;
    }
    
    // Check drugs
    if (appState.selectedDrugs.size === 0) {
        elements.drugError.classList.remove('hidden');
        isValid = false;
    }
    
    return isValid;
}

function setLoadingState(loading) {
    if (loading) {
        showHelixLoader();
        elements.runButton.disabled = true;
        elements.runButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>ANALYZING...</span>
        `;
        elements.runButton.classList.add('opacity-75', 'cursor-not-allowed');
    } else {
        hideHelixLoader();
        elements.runButton.disabled = false;
        elements.runButton.innerHTML = `
            <i class="fa-regular fa-circle-play"></i>
            <span>RUN GENOMIC ANALYSIS</span>
        `;
        elements.runButton.classList.remove('opacity-75', 'cursor-not-allowed');
    }
}

function ensureHelixLoader() {
    if (helixLoaderOverlay) {
        return;
    }

    if (!document.getElementById('helix-loader-style')) {
        const style = document.createElement('style');
        style.id = 'helix-loader-style';
        style.textContent = `
            .helix-loader-overlay {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: radial-gradient(circle at 20% 20%, rgba(30, 64, 175, 0.25), rgba(15, 23, 42, 0.92));
                backdrop-filter: blur(4px);
                display: none;
                align-items: center;
                justify-content: center;
                padding: 1rem;
            }
            .helix-loader-overlay.is-visible {
                display: flex;
            }
            .helix-loader-card {
                width: min(92vw, 460px);
                background: rgba(15, 23, 42, 0.9);
                border: 1px solid rgba(59, 130, 246, 0.35);
                box-shadow: 0 18px 60px rgba(2, 6, 23, 0.65);
                border-radius: 16px;
                padding: 1.25rem;
                color: #e5e7eb;
                text-align: center;
            }
            .helix-loader-svg {
                width: 160px;
                height: 160px;
                margin: 0 auto;
                display: block;
            }
            .helix-loader-strand {
                fill: none;
                stroke-linecap: round;
                stroke-width: 4;
                stroke-dasharray: 12 10;
                animation: helixFlow 1.6s linear infinite;
            }
            .helix-loader-rungs line {
                stroke: rgba(148, 163, 184, 0.75);
                stroke-width: 2.5;
                animation: rungPulse 1.2s ease-in-out infinite;
            }
            .helix-loader-rungs line:nth-child(odd) {
                animation-delay: 0.2s;
            }
            .helix-loader-rungs line:nth-child(3n) {
                animation-delay: 0.45s;
            }
            .helix-loader-title {
                margin-top: 0.5rem;
                font-size: 0.95rem;
                font-weight: 700;
                letter-spacing: 0.08em;
                color: #bfdbfe;
                text-transform: uppercase;
            }
            .helix-loader-subtitle {
                margin-top: 0.4rem;
                font-size: 0.8rem;
                color: #cbd5e1;
            }
            @keyframes helixFlow {
                to {
                    stroke-dashoffset: -44;
                }
            }
            @keyframes rungPulse {
                0%, 100% {
                    opacity: 0.35;
                }
                50% {
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    helixLoaderOverlay = document.createElement('div');
    helixLoaderOverlay.id = 'helix-loader-overlay';
    helixLoaderOverlay.className = 'helix-loader-overlay';
    helixLoaderOverlay.innerHTML = `
        <div class="helix-loader-card" role="status" aria-live="polite" aria-label="Analyzing genomic data">
            <svg class="helix-loader-svg" viewBox="0 0 180 180" aria-hidden="true" focusable="false">
                <path class="helix-loader-strand" stroke="#38bdf8" d="M42 18 C118 38, 62 70, 138 90 C62 110, 118 142, 42 162" />
                <path class="helix-loader-strand" stroke="#22d3ee" d="M138 18 C62 38, 118 70, 42 90 C118 110, 62 142, 138 162" />
                <g class="helix-loader-rungs">
                    <line x1="68" y1="30" x2="112" y2="30" />
                    <line x1="57" y1="45" x2="123" y2="45" />
                    <line x1="46" y1="60" x2="134" y2="60" />
                    <line x1="57" y1="75" x2="123" y2="75" />
                    <line x1="68" y1="90" x2="112" y2="90" />
                    <line x1="57" y1="105" x2="123" y2="105" />
                    <line x1="46" y1="120" x2="134" y2="120" />
                    <line x1="57" y1="135" x2="123" y2="135" />
                    <line x1="68" y1="150" x2="112" y2="150" />
                </g>
            </svg>
            <p class="helix-loader-title">Decoding Genomic Helix</p>
            <p class="helix-loader-subtitle">Cross-checking CPIC pathways and phenotype signals...</p>
        </div>
    `;

    document.body.appendChild(helixLoaderOverlay);
}

function showHelixLoader() {
    ensureHelixLoader();
    helixLoaderOverlay.classList.add('is-visible');
}

function hideHelixLoader() {
    if (!helixLoaderOverlay) {
        return;
    }
    helixLoaderOverlay.classList.remove('is-visible');
}

function updateProgress(percent) {
    elements.progressPercent.textContent = `${percent}%`;
}

function showError(message) {
    alert(`Error: ${message}`);
}

// ===========================
// Results Display
// ===========================
function displayResults(data) {
    // Show results container
    elements.resultsContainer.classList.remove('hidden');
    
    // Show download report button
    if (elements.downloadReportBtn) {
        elements.downloadReportBtn.classList.remove('hidden');
    }
    
    // Store patient ID for report generation
    if (data.analyses && data.analyses.length > 0 && data.analyses[0].patient_id) {
        appState.patientId = data.analyses[0].patient_id;
    }
    
    // Scroll to results
    elements.resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    
    // Display first analysis (if multiple drugs)
    if (data.analyses && data.analyses.length > 0) {
        initDrugResultsSelector(data.analyses);
        displayAnalysis(data.analyses[0]);
    }
    
    // Display JSON
    displayJson(data);
}

function displayAnalysis(analysis) {
    // Profile extraction
    const profile = analysis.pharmacogenomic_profile || {};
    const primaryGene = profile.primary_gene || 'N/A';
    const diplotype = profile.diplotype || 'N/A';
    const variantCount = Array.isArray(profile.detected_variants) ? profile.detected_variants.length : 0;

    // Risk Assessment
    const risk = analysis.risk_assessment;
    let riskLabel = risk.risk_label || 'UNKNOWN';
    
    // Clinical best practice: If no variants found, default to Wild-Type / Standard
    if (riskLabel.includes('No variants') || variantCount === 0) {
        riskLabel = 'STANDARD';
    }

    const severity = normalizeSeverity(risk.severity, riskLabel);
    const confidence = Number.parseFloat(risk.confidence_score) || 0.9; // High confidence for wild-type assumed
    const safeSeverity = Number.isFinite(severity) ? severity : 0;
    const safeConfidence = Number.isFinite(confidence) ? confidence : 0.9;
    const displaySeverityScore = Number.isFinite(safeConfidence) ? safeConfidence * 10 : safeSeverity;
    
    // Update risk status
    elements.riskStatus.textContent = riskLabel;
    elements.riskStatus.className = getRiskClass(riskLabel);
    
    // Update severity
    elements.severityScore.textContent = displaySeverityScore.toFixed(1);
    const severityText = getSeverityText(safeSeverity, risk.severity);
    elements.severityLevel.textContent = `(${severityText})`;
    
    // Update badge colors
    const { bgColor, textColor } = getSeverityColors(riskLabel);
    elements.severityBadge.className = `flex items-center gap-1`;
    elements.severityScore.className = `text-xl font-display font-bold ${textColor}`;
    elements.severityLevel.className = `text-[10px] font-bold ${textColor} uppercase hidden`;
    
    // Update gauge
    updateGauge(safeConfidence, riskLabel, safeSeverity);
    
    // Update variant info
    if (variantCount === 0 || diplotype === 'N/A' || diplotype.includes('No variants')) {
        elements.detectedVariant.innerHTML = `${primaryGene}: *1/*1<br/><span class="text-[10px] text-slate-400 font-normal leading-tight">(Wild-type assumed)</span>`;
    } else {
        elements.detectedVariant.textContent = `${primaryGene}: ${diplotype} (${variantCount} variants)`;
    }
    
    // Display phenotype with helpful context
    const phenotype = profile.phenotype || 'UNKNOWN';
    if (phenotype.includes('No variants') || variantCount === 0) {
        elements.predictedPhenotype.innerHTML = 'Normal<br/><span class="text-[10px] text-slate-400 font-normal leading-tight">(Extensive Metabolizer)</span>';
        elements.predictedPhenotype.title = 'No variants detected; assuming wild-type (*1/*1) Normal Metabolizer';
    } else {
        elements.predictedPhenotype.textContent = phenotype;
        elements.predictedPhenotype.title = '';
    }
    
    // Update tabs
    updateTabs(analysis);

    // Update clinical view summary
    updateClinicalView(analysis);

    // Update Genomic Core View
    updateGenomicCoreView(analysis);
}

function updateGenomicCoreView(analysis) {
    const profile = analysis.pharmacogenomic_profile || {};
    const geneEl = document.getElementById('core-gene-name');
    const genotypeEl = document.getElementById('core-genotype-call');
    const tableBody = document.querySelector('#core-view tbody');

    if (geneEl) geneEl.textContent = profile.primary_gene || 'N/A';
    if (genotypeEl) genotypeEl.textContent = profile.diplotype || 'N/A';

    if (tableBody) {
        tableBody.innerHTML = '';
        const variants = profile.detected_variants || [];
        
        if (variants.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-4 py-8 text-center text-slate-400 italic">No clinically significant variants detected for this drug target.</td>
                </tr>
            `;
        } else {
            variants.forEach(variant => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="px-4 py-3 font-mono text-slate-700">${variant.rsid || 'N/A'}</td>
                    <td class="px-4 py-3">${variant.location || 'N/A'}</td>
                    <td class="px-4 py-3"><span class="font-bold">${variant.ref || ''}</span> > <span class="text-[#0052CC] font-bold">${variant.alt || ''}</span></td>
                    <td class="px-4 py-3 text-right text-emerald-600 font-bold">${variant.qual || '99.9'}</td>
                `;
                tableBody.appendChild(row);
            });
        }
    }
}

function updateClinicalView(analysis) {
    const risk = analysis.risk_assessment || {};
    const recommendation = analysis.clinical_recommendation || {};

    const riskLabel = risk.risk_label || 'Unknown';
    const severityText = getSeverityText(normalizeSeverity(risk.severity, riskLabel), risk.severity);

    elements.clinicalRisk.textContent = riskLabel;
    elements.clinicalRiskDetail.textContent = `Severity: ${severityText}`;
    elements.clinicalUrgency.textContent = (recommendation.urgency || 'routine').toString().toUpperCase();
    elements.clinicalDosage.textContent = recommendation.dosage_adjustment || 'Not available';
    elements.clinicalMonitoring.textContent = recommendation.monitoring || 'Not available';
}

function getRiskClass(riskLabel) {
    const riskUpper = riskLabel.toUpperCase();
    const baseClass = 'text-xl font-display font-bold text-center';
    if (riskUpper.includes('NO VARIANTS') || riskUpper.includes('UNABLE TO')) {
        return `${baseClass} text-slate-400`;
    } else if (riskUpper.includes('SAFE') || riskUpper.includes('NORMAL') || riskUpper.includes('STANDARD')) {
        return `${baseClass} text-emerald-600`;
    } else if (riskUpper.includes('MODERATE') || riskUpper.includes('CAUTION') || riskUpper.includes('ADJUST DOSAGE')) {
        return `${baseClass} text-amber-500`;
    } else if (riskUpper.includes('HIGH') || riskUpper.includes('CRITICAL') || riskUpper.includes('TOXIC') || riskUpper.includes('INEFFECTIVE')) {
        return `${baseClass} text-red-500`;
    }
    return `${baseClass} text-slate-500`;
}

function getSeverityText(severity, rawSeverity) {
    if (typeof rawSeverity === 'string' && rawSeverity.trim()) {
        return rawSeverity.trim().toUpperCase();
    }
    if (severity < 1) return 'NONE';
    if (severity < 3) return 'LOW';
    if (severity < 6) return 'MODERATE';
    if (severity < 8) return 'HIGH';
    return 'CRITICAL';
}

function getSeverityColors(riskLabel) {
    const riskUpper = riskLabel.toUpperCase();
    if (riskUpper.includes('NO VARIANTS') || riskUpper.includes('UNABLE TO')) {
        return { bgColor: 'bg-slate-100', textColor: 'text-slate-400' };
    } else if (riskUpper.includes('SAFE') || riskUpper.includes('NORMAL') || riskUpper.includes('STANDARD')) {
        return { bgColor: 'bg-emerald-50', textColor: 'text-emerald-600' };
    } else if (riskUpper.includes('MODERATE') || riskUpper.includes('CAUTION') || riskUpper.includes('ADJUST DOSAGE')) {
        return { bgColor: 'bg-amber-50', textColor: 'text-amber-500' };
    } else if (riskUpper.includes('HIGH') || riskUpper.includes('CRITICAL') || riskUpper.includes('TOXIC') || riskUpper.includes('INEFFECTIVE')) {
        return { bgColor: 'bg-red-50', textColor: 'text-red-500' };
    }
    return { bgColor: 'bg-slate-50', textColor: 'text-slate-500' };
}

function updateGauge(confidence, riskLabel, severity = 0) {
    const percentage = Math.round(confidence * 100);
    const circumference = 157; // Approximate arc length
    const offset = circumference - (circumference * confidence);
    
    // Update stroke offset
    elements.gaugeArc.style.strokeDashoffset = offset;
    
    // Update color based on severity score (0-10 scale)
    // Maps: 0-2 = green (safe), 3-6 = yellow (caution), 7-10 = red (risk)
    // Special case: if "No variants detected", use gray/muted
    const riskUpper = riskLabel.toUpperCase();
    let color = '#22c55e'; // green (safe)
    if (riskUpper.includes('NO VARIANTS') || riskUpper.includes('UNABLE TO')) {
        color = '#9ca3af'; // gray - no data available
    } else if (severity <= 2) {
        color = '#22c55e'; // Green - Safe
    } else if (severity <= 6) {
        color = '#eab308'; // Yellow - Moderate risk
    } else {
        color = '#ef4444'; // Red - High/Critical risk
    }
    elements.gaugeArc.setAttribute('stroke', color);
}

function updateTabs(analysis) {
    const profile = analysis.pharmacogenomic_profile || {};
    const recommendation = analysis.clinical_recommendation;
    const explanation = analysis.llm_generated_explanation;
    const guidelineUrl = analysis.guideline_url;
    const cpicLevel = analysis.cpic_evidence_level || 'N/A';
    
    // Profile tab
    elements.metadataText.textContent = `${analysis.drug || 'N/A'} - ${profile.primary_gene || 'N/A'} (${profile.diplotype || 'N/A'})`;
    
    // Update CPIC Evidence Level Badge
    if (elements.cpicLevelBadge && cpicLevel !== 'N/A') {
        elements.cpicLevelBadge.textContent = `CPIC Level ${cpicLevel}`;
        
        // Color code based on level
        const badgeParent = elements.cpicLevelBadge.parentElement;
        const baseBadgeClass = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase rounded-md border';
        if (cpicLevel === 'A') {
            badgeParent.className = `${baseBadgeClass} bg-emerald-50 text-emerald-700 border-emerald-200`;
        } else if (cpicLevel === 'B') {
            badgeParent.className = `${baseBadgeClass} bg-blue-50 text-blue-700 border-blue-200`;
        } else if (cpicLevel === 'C' || cpicLevel === 'D') {
            badgeParent.className = `${baseBadgeClass} bg-amber-50 text-amber-700 border-amber-200`;
        }
    }
    
    // Update guideline last updated (use timestamp from analysis or default)
    if (elements.guidelineUpdated && analysis.timestamp) {
        const date = new Date(analysis.timestamp);
        const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        elements.guidelineUpdated.textContent = `Updated: ${monthYear}`;
    }
    
    if (guidelineUrl) {
        elements.guidelineLink.href = guidelineUrl;
        elements.guidelineLink.textContent = guidelineUrl;
        elements.guidelineLink.style.display = 'inline';
    } else {
        elements.guidelineLink.style.display = 'none';
    }
    
    // Recommendation tab
    elements.recommendationContent.innerHTML = formatClinicalRecommendation(recommendation);
    
    // Explanation tab
    elements.explanationContent.innerHTML = formatClinicalExplanation(explanation);
}

function normalizeSeverity(severity, riskLabel) {
    if (typeof severity === 'number') {
        return severity;
    }
    if (typeof severity === 'string') {
        const numeric = Number.parseFloat(severity);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
        const severityMap = {
            none: 0,
            low: 2,
            moderate: 5,
            high: 7,
            critical: 9
        };
        const mapped = severityMap[severity.toLowerCase()];
        if (Number.isFinite(mapped)) {
            return mapped;
        }
    }
    const labelMap = {
        safe: 0,
        normal: 0,
        standard: 0,
        'adjust dosage': 5,
        toxic: 9,
        ineffective: 7,
        unknown: 2
    };
    if (typeof riskLabel === 'string') {
        const normalized = riskLabel.toLowerCase();
        if (labelMap[normalized] !== undefined) {
            return labelMap[normalized];
        }
    }
    return 0;
}

function initDrugResultsSelector(analyses) {
    const select = elements.analysisDrugSelect;
    if (!select) {
        return;
    }

    select.innerHTML = '';
    analyses.forEach((analysis, index) => {
        const option = document.createElement('option');
        option.value = analysis.drug || `analysis-${index + 1}`;
        option.textContent = analysis.drug || `Analysis ${index + 1}`;
        select.appendChild(option);
    });

    select.classList.remove('hidden');
    select.onchange = () => {
        const selected = analyses.find(analysis => analysis.drug === select.value) || analyses[0];
        displayAnalysis(selected);
    };
}

function formatClinicalRecommendation(recommendation) {
    if (!recommendation || typeof recommendation !== 'object') {
        return `<p>${recommendation || 'No recommendation available'}</p>`;
    }

    return `
        <div class="space-y-2">
            <p><strong>Dosage adjustment:</strong> ${recommendation.dosage_adjustment || 'Not available'}</p>
            <p><strong>Monitoring:</strong> ${recommendation.monitoring || 'Not available'}</p>
            <p><strong>Urgency:</strong> <span class="urgency-badge urgency-${(recommendation.urgency || 'routine').toLowerCase()}">${recommendation.urgency || 'Not available'}</span></p>
        </div>
    `;
}

function formatClinicalExplanation(explanation) {
    if (!explanation || typeof explanation !== 'object') {
        return `<p>${explanation || 'No explanation available'}</p>`;
    }

    const notes = Array.isArray(explanation.interaction_notes)
        ? explanation.interaction_notes
        : [];

    return `
        <div class="space-y-2">
            <p><strong>Summary:</strong> ${explanation.summary || 'Not available'}</p>
            <p><strong>Mechanism:</strong> ${explanation.mechanism || 'Not available'}</p>
            <p><strong>Interaction notes:</strong> ${notes.length ? notes.join(' • ') : 'None listed'}</p>
            <p><strong>Evidence basis:</strong> ${explanation.evidence_basis || 'Not available'}</p>
        </div>
    `;
}

// ===========================
// Tab Navigation
// ===========================
function initTabs() {
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

function switchTab(tabName) {
    // Update button styles
    elements.tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.className = 'tab-button border-b-2 border-blue-600 py-2 px-1 text-sm font-medium text-blue-600';
        } else {
            btn.className = 'tab-button border-b-2 border-transparent py-2 px-1 text-sm font-medium text-gray-500 hover:text-gray-700 hover:border-gray-300';
        }
    });
    
    // Show/hide content
    const tabs = ['profile', 'recommendation', 'explanation'];
    tabs.forEach(tab => {
        const content = document.getElementById(`tab-${tab}`);
        if (tab === tabName) {
            content.classList.remove('hidden');
        } else {
            content.classList.add('hidden');
        }
    });
}

// ===========================
// JSON Export
// ===========================
function displayJson(data) {
    const formatted = JSON.stringify(data, null, 2);
    elements.jsonOutput.textContent = formatted;
}

function initJsonExport() {
    // Copy JSON
    elements.copyJson.addEventListener('click', () => {
        const json = elements.jsonOutput.textContent;
        navigator.clipboard.writeText(json).then(() => {
            showToast('JSON copied to clipboard');
        });
    });
    
    // Download JSON
    elements.downloadJson.addEventListener('click', () => {
        const json = elements.jsonOutput.textContent;
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `helixrx-analysis-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('JSON downloaded');
    });
    
    // Refresh JSON
    elements.refreshJson.addEventListener('click', () => {
        if (appState.analysisData) {
            displayJson(appState.analysisData);
            showToast('JSON refreshed');
        }
    });
    
    // Download Report
    if (elements.downloadReportBtn) {
        elements.downloadReportBtn.addEventListener('click', () => {
            downloadReport();
        });
    }
}

function showToast(message) {
    // Simple toast notification (you can enhance this)
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg text-sm z-50';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 2000);
}

// ===========================
// Session Info
// ===========================
function initSession() {
    // Generate random session ID
    const sessionId = `${Math.floor(1000 + Math.random() * 9000)}-BETA`;
    elements.sessionId.textContent = sessionId;
}

// ===========================
// Initialize App
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    initSession();
    initFileUpload();
    initDrugSelector();
    initAnalysis();
    initTabs();
    initJsonExport();
    initViewToggle();
    
    console.log('HelixRx Pro Terminal initialized');
});

function initViewToggle() {
    if (!elements.genomicToggle || !elements.clinicalToggle) {
        return;
    }

    elements.genomicToggle.addEventListener('click', () => {
        setViewMode('genomic');
    });

    elements.clinicalToggle.addEventListener('click', () => {
        setViewMode('clinical');
    });
}

function setViewMode(mode) {
    const isGenomic = mode === 'genomic';
    elements.genomicView.classList.toggle('hidden', !isGenomic);
    elements.clinicalView.classList.toggle('hidden', isGenomic);

    elements.genomicToggle.className = isGenomic
        ? 'bg-white shadow-sm px-3 py-1 rounded text-xs font-bold text-gray-800 uppercase tracking-wide'
        : 'px-3 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-700 uppercase tracking-wide';

    elements.clinicalToggle.className = !isGenomic
        ? 'bg-white shadow-sm px-3 py-1 rounded text-xs font-bold text-gray-800 uppercase tracking-wide'
        : 'px-3 py-1 rounded text-xs font-medium text-gray-500 hover:text-gray-700 uppercase tracking-wide';
}

async function downloadReport() {
    if (!appState.analysisData || !appState.analysisData.analyses || appState.analysisData.analyses.length === 0) {
        showToast('No analysis data available');
        return;
    }
    
    try {
        // Show loading state
        const btn = elements.downloadReportBtn;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>GENERATING...</span>';
        btn.disabled = true;
        
        // Get patient ID from first analysis or use default
        const patientId = appState.patientId || 'PATIENT_UNKNOWN';
        
        // Send request to generate report
        const response = await fetch('/generate-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                analyses: appState.analysisData.analyses,
                patient_id: patientId
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate report');
        }
        
        // Get the HTML report
        const reportHtml = await response.text();
        
        // Create blob and download
        const blob = new Blob([reportHtml], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `helixrx-report-${patientId}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        
        // Restore button state
        btn.innerHTML = originalText;
        btn.disabled = false;
        
        showToast('Report downloaded successfully');
    } catch (error) {
        console.error('Error downloading report:', error);
        showToast('Failed to download report');
        const btn = elements.downloadReportBtn;
        btn.innerHTML = '<i class="fa-solid fa-download"></i> <span>DOWNLOAD REPORT</span>';
        btn.disabled = false;
    }
}
