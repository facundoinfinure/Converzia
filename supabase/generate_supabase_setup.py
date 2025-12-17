import re
from pathlib import Path

ROOT = Path(r"c:\Converzia")


def slurp(rel: str) -> str:
    p = ROOT / rel
    return p.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")


FILES: list[tuple[str, str]] = [
    ("converzia-core/migrations/001_extensions.sql", "001_extensions"),
    ("converzia-core/migrations/002_enums.sql", "002_enums"),
    ("converzia-core/migrations/003_core_tables.sql", "003_core_tables"),
    ("converzia-core/migrations/004_leads_tables.sql", "004_leads_tables"),
    ("converzia-core/migrations/005_billing_tables.sql", "005_billing_tables"),
    ("converzia-core/migrations/006_rag_tables.sql", "006_rag_tables"),
    ("converzia-core/migrations/007_scoring_tables.sql", "007_scoring_tables"),
    ("converzia-core/migrations/008_functions.sql", "008_functions"),
    ("converzia-core/migrations/009_rls_policies.sql", "009_rls_policies"),
    ("converzia-core/migrations/010_views.sql", "010_views"),
    ("converzia-core/migrations/011_app_settings.sql", "011_app_settings"),
    ("converzia-core/migrations/012_integrations_tables.sql", "012_integrations_tables"),
    ("converzia-core/seed/001_initial_seed.sql", "seed_001_initial_seed"),
]


def main() -> None:
    content: dict[str, str] = {}
    for rel, key in FILES:
        content[key] = slurp(rel).strip() + "\n"

    # 1) Patch 002_enums: add integration enums (source from 012)
    if "CREATE TYPE integration_type" not in content["002_enums"]:
        m = re.search(
            r"CREATE TYPE integration_type[\s\S]*?;\n\nCREATE TYPE integration_status[\s\S]*?;",
            content["012_integrations_tables"],
        )
        if not m:
            raise RuntimeError(
                "Could not find integration enums in converzia-core/migrations/012_integrations_tables.sql"
            )
        content["002_enums"] = (
            content["002_enums"].rstrip()
            + "\n\n-- Integrations\n"
            + m.group(0).strip()
            + "\n"
        )

    # 2) Patch 009_rls_policies: remove tenant_integrations enable line
    # (table is created later, and 012 enables RLS itself)
    content["009_rls_policies"] = re.sub(
        r"^ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;\n",
        "",
        content["009_rls_policies"],
        flags=re.M,
    )

    # 3) Patch 011_app_settings: remove duplicate tenant_integrations table + its RLS policies
    content["011_app_settings"] = re.sub(
        r"(?s)-- ============================================\n-- TENANT INTEGRATIONS[\s\S]*?-- ============================================\n-- WHATSAPP MESSAGE TEMPLATES",
        "-- ============================================\n-- WHATSAPP MESSAGE TEMPLATES",
        content["011_app_settings"],
    )

    content["011_app_settings"] = re.sub(
        r"(?s)\n-- Tenant Integrations:[\s\S]*?\n-- Activity Logs:",
        "\n-- Activity Logs:",
        content["011_app_settings"],
    )

    # Add updated_at triggers for tables created after 008
    if "trg_app_settings_updated_at" not in content["011_app_settings"]:
        content["011_app_settings"] = (
            content["011_app_settings"].rstrip()
            + "\n\n-- ============================================\n"
            + "-- TRIGGERS: updated_at maintenance\n"
            + "-- ============================================\n"
            + "CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();\n"
            + "CREATE TRIGGER trg_whatsapp_templates_updated_at BEFORE UPDATE ON whatsapp_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at();\n"
        )

    # 4) Patch 012_integrations_tables: remove enums block (now in 002_enums)
    content["012_integrations_tables"] = re.sub(
        r"(?s)-- ============================================\n-- INTEGRATION TYPE ENUM[\s\S]*?-- ============================================\n-- TENANT INTEGRATIONS",
        "-- ============================================\n-- TENANT INTEGRATIONS",
        content["012_integrations_tables"],
    )

    # 5) Assemble output
    order = [key for _, key in FILES]
    out: list[str] = []
    out.append("-- ============================================")
    out.append("-- Converzia: Supabase Full Setup (single file)")
    out.append("-- Generated from converzia-core/migrations + seed")
    out.append("-- Fixes: integration enums consolidated; tenant_integrations de-duplicated")
    out.append("-- ============================================\n")

    for k in order:
        out.append("\n-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
        out.append(f"-- BEGIN: {k}")
        out.append("-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>\n")
        out.append(content[k].rstrip() + "\n")
        out.append("-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")
        out.append(f"-- END: {k}")
        out.append("-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<\n")

    final = "\n".join(out)
    while "\n\n\n" in final:
        final = final.replace("\n\n\n", "\n\n")

    out_path = ROOT / "supabase" / "supabase_full_setup.sql"
    out_path.write_text(final, encoding="utf-8")
    print(str(out_path))


if __name__ == "__main__":
    main()

