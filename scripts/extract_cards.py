"""从已确认的 Excel v3 提取静态牌库；只用 Python 标准库。"""
import json
import shutil
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'doc/语言大爆炸/Gibberers_DIY_制卡母表_v3_发展标记重判.xlsx'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
with zipfile.ZipFile(SOURCE) as archive:
    strings = []
    if 'xl/sharedStrings.xml' in archive.namelist():
        strings = [''.join(e.itertext()) for e in ET.fromstring(archive.read('xl/sharedStrings.xml')).findall('m:si', NS)]
    rows = []
    for row in ET.fromstring(archive.read('xl/worksheets/sheet2.xml')).findall('.//m:row', NS):
        values = {}
        for cell in row.findall('m:c', NS):
            column = ''.join(c for c in cell.attrib['r'] if c.isalpha())
            value = cell.find('m:v', NS)
            inline = cell.find('m:is', NS)
            text = value.text if value is not None else ''.join(inline.itertext()) if inline is not None else ''
            values[column] = strings[int(text)] if cell.get('t') == 's' else text
        rows.append(values)
    cards = {}
    for row in rows[1:]:
        card_id = int(row['B'])
        card = cards.setdefault(card_id, {'id': card_id, 'generation': int(row['A']), 'entries': []})
        card['entries'].append({'position': int(row['C']), 'en': row['D'], 'text': row['E'], 'icons': [i for i, c in enumerate('FGHIJ') if row.get(c)], 'status': row['K']})
    assert len(cards) == 76 and all(len(c['entries']) == 5 for c in cards.values())
    (ROOT / 'assets/cards.json').write_text(json.dumps(list(cards.values()), ensure_ascii=False, indent=2) + '\n')
for i, path in enumerate(sorted((ROOT / 'doc/语言大爆炸/0世代').glob('*')), 1):
    # 原文件扩展名是 jpg，内容实际为 PNG。
    shutil.copyfile(path, ROOT / f'assets/ancestor-{i}.png')
print('已提取 76 张卡、380 项知识和 5 张绘图卡。')
