"""MIT. Regression against exact NumPy2.3.5's false-value cleanup contract."""
import ast
from pathlib import Path
import unittest
import os
import subprocess
import sys
import tempfile

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

class CandidateSubprocessTests(unittest.TestCase):
    def test_fresh_upstream_subprocess_imports_exact_target_in_chinese_space_path(self):
        helper = next(n for n in module.body if isinstance(n, ast.FunctionDef) and n.name == 'candidate_probe_environment')
        namespace = {'os': os}
        exec(compile(ast.Module(body=[helper], type_ignores=[]), '<actual candidate environment helper>', 'exec'), namespace)
        with tempfile.TemporaryDirectory(prefix='NumPy 中文 空格 ') as work:
            target = Path(work)
            (target / 'ymzz_candidate_sentinel.py').write_text('origin = 27391\n')
            env = namespace['candidate_probe_environment'](target)
            self.assertEqual(env['PYTHONPATH'], str(target))
            # Same fresh, non-isolated interpreter shape as upstream's failing test.
            subprocess.run([sys.executable, '-c', 'import ymzz_candidate_sentinel as m; assert m.origin == 27391'], env=env, check=True, timeout=15)

if __name__ == '__main__':
    unittest.main()
