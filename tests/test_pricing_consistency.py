"""Guard: the frontend pricing fallback must match the backend source of truth.

backend/pricing.py is the single source of truth for the license tier rates.
frontend/src/lib/pricing.js keeps a DEFAULT_PRICING_CONFIG fallback (used until
the live GET /api/pricing response arrives / if it fails). This test fails the
build if the two ever drift apart.
"""
import ast
import json
import pathlib
import re
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_text(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


# ---------- backend (authoritative) ----------

def _literal(node: ast.AST):
    """Evaluate a constant AST node; treat math.inf as None (JSON 'no bound')."""
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.Attribute) and node.attr == "inf":
        return None
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
        return -_literal(node.operand)
    if isinstance(node, (ast.Tuple, ast.List)):
        return [_literal(e) for e in node.elts]
    raise AssertionError(f"Unsupported node: {ast.dump(node)}")


def _assignments(module: ast.Module) -> dict:
    values = {}
    for node in module.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            try:
                values[node.targets[0].id] = _literal(node.value)
            except AssertionError:
                pass
    return values


def backend_config() -> dict:
    module = ast.parse(read_text("backend/pricing.py"))
    v = _assignments(module)
    tiers = [{"upTo": up_to, "rate": rate} for up_to, rate in v["PRICE_TIERS"]]
    return {
        "tiers": tiers,
        "minUsers": v["MIN_USERS"],
        "maxSliderUsers": v["MAX_SLIDER_USERS"],
        "defaultUsers": v["DEFAULT_USERS"],
        "annualFreeMonths": v["ANNUAL_FREE_MONTHS"],
        "presetPlans": v["PRESET_PLANS"],
    }


# ---------- frontend fallback ----------

def _extract_object(text: str, marker: str) -> str:
    start = text.index("{", text.index(marker))
    depth = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return text[start:i + 1]
    raise AssertionError(f"Unbalanced braces after marker {marker!r}")


def frontend_config() -> dict:
    obj = _extract_object(read_text("frontend/src/lib/pricing.js"), "DEFAULT_PRICING_CONFIG")
    obj = re.sub(r"//[^\n]*", "", obj)              # strip line comments
    obj = re.sub(r'([{\[,]\s*)(\w+):', r'\1"\2":', obj)  # quote object keys
    obj = re.sub(r",(\s*[}\]])", r"\1", obj)         # drop trailing commas
    return json.loads(obj)


class PricingConsistencyTests(unittest.TestCase):
    def test_frontend_fallback_matches_backend(self):
        self.assertEqual(
            backend_config(),
            frontend_config(),
            "frontend/src/lib/pricing.js DEFAULT_PRICING_CONFIG is out of sync with "
            "backend/pricing.py — update the fallback to match the backend rates.",
        )


if __name__ == "__main__":
    unittest.main()
