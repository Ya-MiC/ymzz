"""MIT. Regression against exact NumPy2.3.5's false-value cleanup contract."""
import ast
from pathlib import Path
import unittest

module = ast.parse(Path(__file__).with_name('qualify-numpy-fallback.py').read_text())
probe = next(ast.literal_eval(node.value) for node in ast.walk(module)
             if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'probe' for t in node.targets))
# Exercise the actual embedded probe's backend assertion, not a duplicated helper.
check = probe.split("config=np.show_config(mode='dicts')", 1)[1].split('from numpy.testing', 1)[0]

class BackendSchemaTests(unittest.TestCase):
    def test_exact_cleanup_omits_false_found(self):
        exec(check, {'config': {'Build Dependencies': {n: {'name': 'none'} for n in ('blas', 'lapack')}}})

    def test_explicit_false_is_also_valid(self):
        exec(check, {'config': {'Build Dependencies': {n: {'name': 'none', 'found': False} for n in ('blas', 'lapack')}}})

    def test_external_found_or_unknown_backend_fails(self):
        for replacement in ({'name': 'openblas', 'found': True}, {'name': 'none', 'found': True}, {}, {'found': False}):
            with self.subTest(replacement=replacement), self.assertRaises(AssertionError):
                exec(check, {'config': {'Build Dependencies': {'blas': replacement, 'lapack': {'name': 'none'}}}})

    def test_missing_required_schema_fails_closed(self):
        with self.assertRaises(KeyError):
            exec(check, {'config': {}})

if __name__ == '__main__':
    unittest.main()
