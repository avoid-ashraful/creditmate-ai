#!/usr/bin/env python3
"""
Script to create GitHub Issues from the enhancement plan.
Requires: gh CLI authenticated (gh auth login)
"""

import subprocess
import json
import sys
from pathlib import Path

# Read the task breakdown
TASK_FILE = Path("/home/ubuntu/credit/TASK_BREAKDOWN.md")

# Since we can't actually create issues without gh auth, we'll output the commands
# that the user can run, or create a JSON file for import

STREAM_TASKS = {
    "1": [
        ("1.1", "Fix Database Schema - Nullable Critical Fields", "P0", "2 days"),
        ("1.2", "Connect Frontend to Backend API", "P0", "3 days"),
        ("1.3", "Redis Caching Layer", "P1", "3 days"),
        ("1.4", "API Rate Limiting & Request Validation", "P1", "2 days"),
        ("1.5", "Error Tracking (Sentry) Integration", "P1", "1 day"),
    ],
    "2": [
        ("2.1", "Deploy Improved Crawler with Quality Scoring", "P0", "4 days"),
        ("2.2", "Data Quality Dashboard", "P0", "3 days"),
        ("2.3", "Manual Review Queue", "P1", "3 days"),
        ("2.4", "Multi-Source Validation", "P1", "4 days"),
        ("2.5", "Historical Tracking & Change Detection", "P2", "3 days"),
    ],
    "3": [
        ("3.1", "Category-Based Browsing", "P1", "2 days"),
        ("3.2", "Smart Recommendation Quiz", "P0", "4 days"),
        ("3.3", "Annual Fee vs Rewards Calculator", "P0", "3 days"),
        ("3.4", "Card Detail Deep-Dive Pages", "P0", "4 days"),
        ("3.5", "\"Why This Card Wins\" AI Narratives", "P1", "3 days"),
        ("3.6", "Mobile-First Comparison Table", "P0", "3 days"),
    ],
    "4": [
        ("4.1", "Design Token System", "P0", "3 days"),
        ("4.2", "Storybook Component Library", "P1", "4 days"),
        ("4.3", "WCAG 2.1 AA Compliance", "P1", "4 days"),
        ("4.4", "Dark Mode Support", "P2", "3 days"),
        ("4.5", "Micro-interactions & Motion", "P2", "2 days"),
    ],
    "5": [
        ("5.1", "Fix HomePage Test (Mock API)", "P0", "1 day"),
        ("5.2", "Playwright E2E Tests (10 Critical Paths)", "P0", "4 days"),
        ("5.3", "Visual Regression Testing", "P1", "2 days"),
        ("5.4", "API Contract Tests", "P1", "2 days"),
        ("5.5", "Performance Budgets & Monitoring", "P1", "2 days"),
        ("5.6", "Load Testing (k6)", "P2", "2 days"),
    ],
    "6": [
        ("6.1", "Elasticsearch/Meilisearch Setup", "P1", "2 days"),
        ("6.2", "Search Autocomplete & Facets", "P1", "3 days"),
        ("6.3", "Advanced Search Features", "P2", "2 days"),
    ],
    "7": [
        ("7.1", "Authentication System", "P1", "3 days"),
        ("7.2", "Saved Comparisons & Collections", "P1", "3 days"),
        ("7.3", "Email Alerts & Notifications", "P1", "3 days"),
        ("7.4", "Community Reviews", "P2", "4 days"),
    ],
    "8": [
        ("8.1", "GitHub Actions CI Pipeline", "P1", "2 days"),
        ("8.2", "Staging Environment", "P1", "2 days"),
        ("8.3", "Production Kubernetes Configs", "P1", "3 days"),
        ("8.4", "Monitoring & Alerting", "P1", "2 days"),
        ("8.5", "Security Hardening", "P1", "2 days"),
    ],
    "9": [
        ("9.1", "User Guides & How-Tos", "P2", "3 days"),
        ("9.2", "Bengali Glossary & Localization Prep", "P2", "3 days"),
        ("9.3", "API Documentation", "P1", "2 days"),
        ("9.4", "Developer Documentation", "P1", "2 days"),
    ],
    "10": [
        ("10.1", "Event Tracking Implementation", "P0", "2 days"),
        ("10.2", "Conversion Funnel Dashboard", "P1", "2 days"),
        ("10.3", "A/B Testing Framework", "P2", "3 days"),
        ("10.4", "SEO & Content Strategy", "P2", "3 days"),
    ],
}

def generate_gh_commands():
    """Generate gh CLI commands for creating issues"""
    commands = []
    for stream_id, tasks in STREAM_TASKS.items():
        for task_id, title, priority, effort in tasks:
            labels = f"stream:{stream_id},priority:{priority},effort:{effort}"
            body = f"""## Stream {stream_id} - Task {task_id}
**Priority**: {priority} | **Effort**: {effort}

### Description
See [TASK_BREAKDOWN.md](/home/ubuntu/credit/TASK_BREAKDOWN.md) for detailed acceptance criteria.

### Definition of Done
- [ ] Code complete & reviewed
- [ ] Tests passing (unit + e2e if applicable)
- [ ] Deployed to staging
- [ ] Demoed to Product Owner
- [ ] Documentation updated
"""
            cmd = f'gh issue create --title "[Stream {stream_id}] {title}" --label "{labels}" --body "{body}"'
            commands.append(cmd)
    return commands

def generate_json_for_import():
    """Generate JSON for GitHub Issues bulk import"""
    issues = []
    for stream_id, tasks in STREAM_TASKS.items():
        for task_id, title, priority, effort in tasks:
            issues.append({
                "title": f"[Stream {stream_id}] {title}",
                "labels": [f"stream:{stream_id}", f"priority:{priority}", f"effort:{effort}"],
                "body": f"""## Stream {stream_id} - Task {task_id}
**Priority**: {priority} | **Effort**: {effort}

### Description
See TASK_BREAKDOWN.md for detailed acceptance criteria.

### Definition of Done
- [ ] Code complete & reviewed
- [ ] Tests passing (unit + e2e if applicable)
- [ ] Deployed to staging
- [ ] Demoed to Product Owner
- [ ] Documentation updated
"""
            })
    return issues

if __name__ == "__main__":
    print("=" * 60)
    print("GITHUB ISSUES CREATION COMMANDS")
    print("=" * 60)
    print("\nRun these commands after: gh auth login")
    print()
    
    for cmd in generate_gh_commands():
        print(cmd)
    
    print("\n" + "=" * 60)
    print(f"Total issues: {sum(len(t) for t in STREAM_TASKS.values())}")
    print("=" * 60)
    
    # Also save JSON for reference
    import json
    with open("/home/ubuntu/credit/github_issues.json", "w") as f:
        json.dump(generate_json_for_import(), f, indent=2)
    print("\nJSON saved to /home/ubuntu/credit/github_issues.json")
