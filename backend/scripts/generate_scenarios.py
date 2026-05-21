"""Generates 50 diverse test scenarios"""
import json, random
from pathlib import Path

random.seed(42)
BORROWERS = ["CORP-001", "CORP-002", "CORP-003", "CORP-004", "CORP-005"]

def generate_scenario(scenario_num):
    borrower_id = random.choice(BORROWERS)
    quarter, year = random.choice(["Q1","Q2","Q3","Q4"]), random.choice([2024,2025,2026])
    
    profiles_path = Path(__file__).parent.parent / "data" / "borrower_profiles.json"
    with open(profiles_path) as f:
        profiles = json.load(f)
    borrower = next(b for b in profiles["borrowers"] if b["borrower_id"] == borrower_id)
    
    max_leverage = borrower["covenants"]["max_debt_to_ebitda"]
    min_coverage = borrower["covenants"]["min_interest_coverage"]
    min_liquidity = borrower["covenants"]["min_liquidity_ratio"]
    has_adjustments = borrower.get("has_accounting_adjustments", False)
    has_grace = borrower.get("has_grace_period", False)
    
    scenario_type = random.choices(["no_breach","breach","imminent","near_threshold"], weights=[0.4,0.3,0.15,0.15])[0]
    base_ebitda = random.uniform(40, 120)
    adjustment_amount = random.uniform(5, 25) if has_adjustments and random.random()<0.7 else 0
    adjusted_ebitda = base_ebitda + adjustment_amount
    
    if scenario_type == "no_breach":
        target_ratio = random.uniform(max_leverage*0.6, max_leverage*0.85)
    elif scenario_type == "breach":
        target_ratio = random.uniform(max_leverage*1.1, max_leverage*1.5)
    elif scenario_type == "imminent":
        target_ratio = random.uniform(max_leverage*0.96, max_leverage*0.99)
    else:
        target_ratio = random.uniform(max_leverage*0.98, max_leverage*1.02)
    
    total_debt = target_ratio * adjusted_ebitda
    interest_expense = random.uniform(5, 20)
    current_liabilities = random.uniform(30, 80)
    liquidity_ratio = random.uniform(0.8, 2.5)
    current_assets = liquidity_ratio * current_liabilities
    
    debt_to_ebitda = total_debt / adjusted_ebitda
    interest_coverage = adjusted_ebitda / interest_expense
    
    leverage_breach = debt_to_ebitda > max_leverage
    coverage_breach = interest_coverage < min_coverage
    liquidity_breach = liquidity_ratio < min_liquidity
    any_breach = leverage_breach or coverage_breach or liquidity_breach
    
    if any_breach:
        expected_verdict = "breach_curable" if has_grace else "breach"
    else:
        imminent = debt_to_ebitda > max_leverage*0.95 or interest_coverage < min_coverage*1.05 or liquidity_ratio < min_liquidity*1.05
        expected_verdict = "imminent" if imminent else "no_breach"
    
    return {
        "scenario_id": f"SCEN-{scenario_num:03d}",
        "borrower_id": borrower_id,
        "quarter": quarter,
        "year": year,
        "reported_ebitda": round(base_ebitda, 2),
        "total_debt": round(total_debt, 2),
        "interest_expense": round(interest_expense, 2),
        "current_assets": round(current_assets, 2),
        "current_liabilities": round(current_liabilities, 2),
        "restructuring_charges": round(adjustment_amount, 2) if has_adjustments else 0,
        "expected_verdict": expected_verdict,
        "scenario_type": scenario_type
    }

def main():
    scenarios = [generate_scenario(i) for i in range(1,51)]
    verdicts = [s["expected_verdict"] for s in scenarios]
    print(f"Generated {len(scenarios)} scenarios:")
    print(f"  no_breach: {verdicts.count('no_breach')}")
    print(f"  breach: {verdicts.count('breach')}")
    print(f"  breach_curable: {verdicts.count('breach_curable')}")
    print(f"  imminent: {verdicts.count('imminent')}")
    
    output_path = Path(__file__).parent.parent / "data" / "ground_truth.json"
    with open(output_path, "w") as f:
        json.dump({"scenarios": scenarios}, f, indent=2)
    print(f"\n✅ Saved to {output_path}")

if __name__ == "__main__":
    main()
