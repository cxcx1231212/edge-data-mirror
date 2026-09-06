#!/usr/bin/env python3
import gzip
import re
import sqlite3
import sys

TABLES = {
    "ad_clicks", "ad_stats", "admin_login_attempts", "admins", "ads",
    "analytics_daily", "analytics_visitors", "automation_runs", "materials",
    "public_rate_limits", "smart_strategy_state",
}

def split_values(source):
    rows, row, value = [], [], []
    quoted = escaped = False
    depth = 0
    for char in source.strip().rstrip(";"):
        if quoted:
            if escaped:
                value.append({"n":"\n", "r":"\r", "t":"\t", "0":"\0"}.get(char, char))
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == "'":
                quoted = False
            else:
                value.append(char)
            continue
        if char == "'":
            quoted = True
        elif char == "(":
            depth += 1
            if depth > 1: value.append(char)
        elif char == ")":
            depth -= 1
            if depth == 0:
                row.append("".join(value).strip())
                rows.append(row); row, value = [], []
            else: value.append(char)
        elif char == "," and depth == 1:
            token = "".join(value).strip()
            row.append(None if token.upper() == "NULL" else token)
            value = []
        elif depth:
            value.append(char)
    return rows

def main(source, schema, destination):
    raw = gzip.open(source, "rt", encoding="utf-8").read()
    db = sqlite3.connect(destination)
    db.executescript(open(schema, encoding="utf-8").read())
    for match in re.finditer(r"^INSERT INTO `([^`]+)` VALUES (.*);$", raw, re.M):
        table, values = match.groups()
        if table not in TABLES: continue
        rows = split_values(values)
        if not rows: continue
        marks = ",".join("?" for _ in rows[0])
        db.executemany(f"INSERT OR REPLACE INTO `{table}` VALUES ({marks})", rows)
    db.commit()
    for table in sorted(TABLES):
        print(f"{table}: {db.execute(f'SELECT COUNT(*) FROM `{table}`').fetchone()[0]}")
    db.close()

if __name__ == "__main__":
    main(*sys.argv[1:4])
