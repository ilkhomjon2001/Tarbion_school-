"""T-021 audit jurnali ozgartirilmaydi

Audit yozuvi oʻzgartirilmaydi va oʻchirilmaydi (CLAUDE.md 4-qoida).

Bu qoidani ILOVA darajasida saqlash yetarli emas. Audit jurnali aynan
ilovaga (yoki uni yozgan odamga) ishonib boʻlmagan holat uchun kerak:
· xodim oʻz izini yashirishga urinsa
· hujumchi ilovaga kirsa va tarixni tozalasa
· kimdir `psql` ochib `DELETE FROM audit_log` yozsa

Shu sababli taqiq BAZADA — trigger orqali. Uni faqat jadval egasi
oʻchira oladi; ilovaning roli esa `CREATE` huquqisiz (X-11).

Revision ID: 762b31f06227
Revises: 410e951efdfc
Create Date: 2026-08-31 15:23:25.038058

"""

from collections.abc import Sequence

from alembic import op

revision: str = "762b31f06227"
down_revision: str | Sequence[str] | None = "410e951efdfc"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


FUNKSIYA = """
CREATE OR REPLACE FUNCTION tarbion_audit_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION
        'audit_log yozuvi ozgartirilmaydi va ochirilmaydi (CLAUDE.md 4-qoida)'
        USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    op.execute(FUNKSIYA)

    # UPDATE va DELETE alohida trigger: xato matni qaysi amal
    # urinilganini koʻrsatsin.
    op.execute(
        """
        CREATE TRIGGER audit_log_no_update
        BEFORE UPDATE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION tarbion_audit_immutable();
        """
    )
    op.execute(
        """
        CREATE TRIGGER audit_log_no_delete
        BEFORE DELETE ON audit_log
        FOR EACH ROW EXECUTE FUNCTION tarbion_audit_immutable();
        """
    )
    # TRUNCATE qatorlarni aylanib oʻtadi — u qator darajasidagi
    # triggerni umuman chaqirmaydi. Alohida statement trigger kerak.
    op.execute(
        """
        CREATE TRIGGER audit_log_no_truncate
        BEFORE TRUNCATE ON audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION tarbion_audit_immutable();
        """
    )

    # Kirish jurnali ham xuddi shunday: AUT-06 boʻyicha "kim qachon
    # kirdi" savolining javobi oʻzgarmasligi kerak.
    op.execute(
        """
        CREATE TRIGGER login_log_no_update
        BEFORE UPDATE ON login_log
        FOR EACH ROW EXECUTE FUNCTION tarbion_audit_immutable();
        """
    )
    op.execute(
        """
        CREATE TRIGGER login_log_no_delete
        BEFORE DELETE ON login_log
        FOR EACH ROW EXECUTE FUNCTION tarbion_audit_immutable();
        """
    )


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS login_log_no_delete ON login_log")
    op.execute("DROP TRIGGER IF EXISTS login_log_no_update ON login_log")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_truncate ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_delete ON audit_log")
    op.execute("DROP TRIGGER IF EXISTS audit_log_no_update ON audit_log")
    op.execute("DROP FUNCTION IF EXISTS tarbion_audit_immutable()")
