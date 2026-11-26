"""Writes one line to the activity log. Best effort: a logging problem never blocks the real action."""
from uuid import UUID

from psycopg.rows import dict_row

from postlight.database import connection


def log_activity(actor_id: UUID | None, action: str, target: str = "", detail: str = "") -> None:
    try:
        with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            name = "Visitor"
            if actor_id:
                cur.execute(
                    "select coalesce(p.display_name, split_part(u.email, '@', 1)) as name "
                    "from auth.users u left join public.profiles p on p.user_id = u.id where u.id = %s",
                    (actor_id,),
                )
                found = cur.fetchone()
                if found and found["name"]:
                    name = found["name"]
            cur.execute(
                "insert into public.activity_log (actor_id, actor_name, action, target, detail) "
                "values (%s, %s, %s, %s, %s)",
                (actor_id, name, action[:80], target[:200], detail[:500]),
            )
    except Exception:
        pass
