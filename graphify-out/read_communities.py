import json
from pathlib import Path

analysis = json.loads(Path('graphify-out/.graphify_analysis.json').read_text(encoding="utf-8"))
communities = analysis['communities']

for cid, node_ids in sorted(communities.items(), key=lambda x: -len(x[1])):
    print(f"\nCommunity {cid} ({len(node_ids)} nodes):")
    for nid in node_ids[:8]:
        print(f"  {nid}")