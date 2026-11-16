"""Guard against slides shadowing viewer controls. Run: python3 tests/viewer-id-tests.py"""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


class ElementIDs(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.ids = []
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        value = dict(attrs).get('id')
        if value:
            self.ids.append(value)


class ViewerIDTests(unittest.TestCase):
    def test_slide_ids_do_not_shadow_controls(self):
        # Slides precede the toolbar in document order. A shared ID can make
        # updateUI() replace a whole slide with the page count (4.4, page 10).
        slides = sorted((ROOT / 'decks').glob('*/slides/*.html'))
        self.assertTrue(slides, 'No slide fixtures found')
        slide_ids = [(path, set(ElementIDs(path).ids)) for path in slides]
        for viewer in ('index.html', 'notes.html'):
            with self.subTest(viewer=viewer):
                control_ids = ElementIDs(ROOT / 'viewer' / viewer).ids
                duplicates = [key for key, count in Counter(control_ids).items() if count > 1]
                self.assertEqual(duplicates, [], 'Duplicate IDs within the viewer')
                conflicts = [
                    f'{path.relative_to(ROOT)}: {", ".join(sorted(ids & set(control_ids)))}'
                    for path, ids in slide_ids if ids & set(control_ids)
                ]
                self.assertEqual(conflicts, [], 'Slides must not share IDs with viewer controls')


if __name__ == '__main__':
    unittest.main()
