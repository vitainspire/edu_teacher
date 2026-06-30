import sys, json
from graphify.build import build_from_json
from graphify.cluster import score_all
from graphify.analyze import god_nodes, surprising_connections, suggest_questions
from graphify.report import generate
from pathlib import Path

extraction = json.loads(Path('graphify-out/.graphify_extract.json').read_text(encoding="utf-8"))
detection  = json.loads(Path('graphify-out/.graphify_detect.json').read_text(encoding="utf-8"))
analysis   = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding="utf-8"))

G = build_from_json(extraction)
communities = {int(k): v for k, v in analysis['communities'].items()}
cohesion = {int(k): v for k, v in analysis['cohesion'].items()}
tokens = {'input': extraction.get('input_tokens', 0), 'output': extraction.get('output_tokens', 0)}

labels = {
    0: "AI API Routes",
    1: "Teacher Dashboard UI",
    2: "App Config & PWA",
    3: "Supabase Data Layer",
    4: "Student Management & AI Cache",
    5: "Package Dependencies",
    6: "App State & Local DB",
    7: "AI Grading Pipeline (Scanner)",
    8: "Student Analytics & Graders",
    9: "Marks & Catchup Flow",
    10: "Batch Scan Pipeline",
    11: "TypeScript Config",
    12: "Class Management & Onboarding",
    13: "Student Potential & Mastery",
    14: "Scanner Grading Flow",
    15: "Daily Briefing & Marks",
    16: "Supabase Auth & Storage",
    17: "OCR Pipeline Client",
    18: "IndexedDB Schema",
    19: "Navigation & Dashboard Layout",
    20: "User Onboarding Guides",
    21: "Question Generation UI",
    22: "Scanner Shell Components",
    23: "Exam Grading APIs",
    24: "AI & Logging Utilities",
    25: "Student Alerts & Interventions",
    26: "PWA Manifest",
    27: "Auth & Login",
    28: "Scanner Shell Layout",
    29: "Vercel Deployment Config",
    30: "Test & Marks Management",
    31: "Exam Question Generator",
    32: "Scan Progress UI",
    33: "Syllabus & Lesson Planning",
    34: "Attendance & Engagement",
    35: "Student Roster Management",
    36: "Analytics & Visualization",
    37: "Paper Grading Route",
    38: "Class Creation & Modals",
    39: "App Shell & Routing",
    40: "Score Chart",
    41: "Class Pulse & Peer Pairing",
    42: "Mark Entry Component",
    43: "Voice Mark Entry",
    44: "Auth Middleware",
    45: "Health Check & Supabase Client",
    46: "Speech Recognition Types",
    47: "Sync Status UI",
    48: "Feature Tour",
    49: "Loading Skeletons",
    50: "Attendance Chart",
    51: "Rate Limiting",
    52: "CSS & Utilities Config",
    53: "Next.js Config",
    54: "Server TTL Cache",
    55: "Skeleton Components",
    56: "TypeScript Extensions",
    57: "Service Worker",
    58: "Fingerprint Type",
    59: "PotentialSignal Type",
}

questions = suggest_questions(G, communities, labels)
report = generate(G, communities, cohesion, labels, analysis['gods'], analysis['surprises'], detection, tokens, '.', suggested_questions=questions)
Path('graphify-out/GRAPH_REPORT.md').write_text(report, encoding="utf-8")
Path('graphify-out/.graphify_labels.json').write_text(json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8")
print('Report updated with community labels')
print(f'Suggested questions: {len(questions)}')
for q in questions[:5]:
    print(f'  - {q}')