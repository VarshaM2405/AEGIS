import sys
import unittest
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import String

from database import IS_SQLITE, get_geom_column


class DatabaseConfigurationTests(unittest.TestCase):
    def test_defaults_to_sqlite_when_no_database_url_is_set(self):
        self.assertTrue(IS_SQLITE)

    def test_geom_column_uses_string_for_sqlite(self):
        self.assertEqual(get_geom_column(), String)


if __name__ == "__main__":
    unittest.main()
