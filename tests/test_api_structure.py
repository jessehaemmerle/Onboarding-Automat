import ast
import pathlib
import re
import unittest
from collections import defaultdict


REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_text(relative_path: str) -> str:
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


def parse_module(relative_path: str) -> ast.Module:
    return ast.parse(read_text(relative_path), filename=relative_path)


def extract_router_prefix(module: ast.Module, router_name: str) -> str:
    for node in module.body:
        if not isinstance(node, ast.Assign):
            continue
        if len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
            continue
        if node.targets[0].id != router_name:
            continue
        if not isinstance(node.value, ast.Call):
            continue
        if not isinstance(node.value.func, ast.Name) or node.value.func.id != "APIRouter":
            continue

        for keyword in node.value.keywords:
            if keyword.arg == "prefix" and isinstance(keyword.value, ast.Constant):
                return keyword.value.value
    return ""


def collect_routes(relative_path: str, router_name: str, base_prefix: str) -> list[tuple[str, str, str]]:
    module = parse_module(relative_path)
    router_prefix = extract_router_prefix(module, router_name)
    routes = []

    for node in module.body:
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue

        for decorator in node.decorator_list:
            if not isinstance(decorator, ast.Call):
                continue
            if not isinstance(decorator.func, ast.Attribute):
                continue
            if not isinstance(decorator.func.value, ast.Name):
                continue
            if decorator.func.value.id != router_name:
                continue
            if not decorator.args or not isinstance(decorator.args[0], ast.Constant):
                continue

            method = decorator.func.attr.upper()
            path = f"{base_prefix}{router_prefix}{decorator.args[0].value}"
            routes.append((method, path, node.name))

    return routes


def collect_all_routes() -> list[tuple[str, str, str]]:
    server_routes = collect_routes("backend/server.py", "api_router", "")
    app_routes = collect_routes("backend/server.py", "app", "")
    task_routes = collect_routes("backend/routers/tasks.py", "router", "/api")
    billing_routes = collect_routes("backend/routers/billing.py", "router", "/api")
    return server_routes + app_routes + task_routes + billing_routes


def extract_class_fields(relative_path: str, class_name: str) -> set[str]:
    module = parse_module(relative_path)
    for node in module.body:
        if isinstance(node, ast.ClassDef) and node.name == class_name:
            fields = set()
            for item in node.body:
                if isinstance(item, ast.AnnAssign) and isinstance(item.target, ast.Name):
                    fields.add(item.target.id)
            return fields
    raise AssertionError(f"Class {class_name} not found in {relative_path}")


class ApiStructureTests(unittest.TestCase):
    def test_route_method_pairs_are_unique(self):
        route_map = defaultdict(list)
        for method, path, name in collect_all_routes():
            route_map[(method, path)].append(name)

        duplicates = {
            f"{method} {path}": names
            for (method, path), names in route_map.items()
            if len(names) > 1
        }
        self.assertEqual({}, duplicates)

    def test_expected_routes_still_exist(self):
        paths = {path for _, path, _ in collect_all_routes()}
        for expected in {
            "/health",
            "/api/tasks/{task_id}/comments",
            "/api/tasks/{task_id}/evidence",
            "/api/evidence-policies",
            "/api/billing/tiers",
        }:
            self.assertIn(expected, paths)

    def test_comment_payload_accepts_legacy_and_new_keys(self):
        source = read_text("backend/routers/tasks.py")
        self.assertIn('AliasChoices("body", "content")', source)

    def test_evidence_response_keeps_legacy_fields(self):
        fields = extract_class_fields("backend/routers/tasks.py", "EvidenceResponse")
        self.assertTrue({"file_type", "content_type", "uploaded_by_name"} <= fields)

    def test_router_modules_no_longer_patch_sys_path(self):
        for path in ["backend/routers/tasks.py", "backend/routers/billing.py"]:
            with self.subTest(path=path):
                self.assertNotRegex(read_text(path), r"sys\.path\.append")

    def test_router_modules_use_shared_auth_helpers(self):
        for path in ["backend/routers/tasks.py", "backend/routers/billing.py"]:
            with self.subTest(path=path):
                source = read_text(path)
                self.assertRegex(source, r"from \.\.?auth import|from \.\.\.auth import|from auth import")

    def test_license_key_generator_keeps_expected_prefix(self):
        source = read_text("backend/auth.py")
        self.assertIn('return f"OA-{\'-\'.join(parts)}"', source)


if __name__ == "__main__":
    unittest.main()
