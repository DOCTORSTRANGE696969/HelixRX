# HelixRx

Live url: https://helixrx-bff6c.web.app/

## Problem Understanding
Adverse drug reactions (ADRs) are a major healthcare challenge, often caused by differences in how individuals metabolize drugs based on their genetic makeup. Despite the availability of pharmacogenomic data, it is rarely used in clinical practice due to the complexity of interpreting genomic information and lack of accessible tools.

This problem focuses on converting raw genetic data (VCF files) into meaningful insights by identifying key gene variants and predicting drug-specific responses such as safe usage, toxicity, or dosage adjustments. Additionally, there is a need for explainable AI systems that provide clear, clinically relevant justifications for these predictions.

The core challenge is to build a system that bridges the gap between complex genomic data and practical medical decision-making, enabling personalized and safer treatment recommendations.

## Proposed Solution
Our solution, HelixRx, is an AI-powered precision medicine platform that transforms raw genomic data into actionable clinical insights for safer drug prescribing.

The system ingests patient VCF files and extracts key pharmacogenomic variants across clinically significant genes (e.g., CYP2D6, CYP2C19). These variants are mapped to diplotypes and metabolic phenotypes, enabling accurate prediction of drug response categories such as Safe, Adjust Dosage, Toxic, or Ineffective using CPIC-aligned logic.

To enhance clinical usability, we integrate an LLM to generate clear, evidence-backed explanations describing the biological mechanisms behind each prediction. Additionally, our system includes a fallback AI layer to analyze unsupported drugs, ensuring broader applicability beyond predefined datasets.

We further improve reliability through confidence scoring based on data completeness and variant quality. The results are delivered via an intuitive web interface with visual risk indicators, detailed breakdowns, and structured JSON outputs for interoperability.

By combining genomics, rule-based clinical standards, and explainable AI, our approach bridges the gap between complex genetic data and real-world medical decision-making, enabling scalable and personalized healthcare.

## AI Approach
Our approach combines rule-based clinical intelligence with explainable AI to ensure both accuracy and trust.

We use a hybrid model where pharmacogenomic risk prediction is primarily driven by deterministic, CPIC-guideline-based logic, mapping genetic variants to phenotypes and corresponding drug-response outcomes. This ensures clinical reliability and compliance with established medical standards.

On top of this, we integrate a Large Language Model (LLM) to enhance interpretability by generating structured, evidence-backed explanations that describe variant-level impact, metabolic pathways, and drug interactions in a clinician-friendly format.

To improve robustness, we implement a fallback LLM-based inference layer for drugs or cases not covered by existing CPIC rules, enabling broader generalization. Additionally, we incorporate confidence scoring mechanisms based on data completeness and variant quality to quantify prediction reliability.

This hybrid architecture balances precision, scalability, and explainability, making the system both clinically trustworthy and practically deployable.

## Target Users
Primary users are clinicians, pharmacists, and genetic specialists who need personalized drug recommendations. Secondary users include hospitals, diagnostic labs, and researchers working with genomic data.
