import openpyxl
import json
import os

def extract_units_ultra_safe():
    file_path = '0 ผลการตรวจสอบรายการอัตราค่าบริการสาธารณสุขฯ.xlsx'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    # Use read_only=True for memory efficiency
    try:
        wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
        sheet = wb.active
        
        units = []
        # Iterate over rows
        for i, row in enumerate(sheet.iter_rows(min_row=2, values_only=True)):
            if not any(row): continue
            
            # Map columns cautiously
            # We expect: [0: Prov, 1: Region, 2: Name, 3: Type]
            prov = str(row[0]).strip() if row[0] else ""
            name = str(row[2]).strip() if len(row) > 2 and row[2] else ""
            type_val = str(row[3]).strip() if len(row) > 3 and row[3] else ""
            
            if not name or name == 'หน่วยงาน': continue
            
            units.append({
                "province": prov,
                "name": name,
                "type": type_val,
                "status": 0,
                "startDate": "",
                "outcome": "",
                "updateDate": "",
                "fileLink": ""
            })
            
            if i % 100 == 0:
                print(f"Processed {i} rows...")

        with open('dashboard_moph/data.js', 'w', encoding='utf-8') as f:
            f.write('const initialData = ' + json.dumps(units, ensure_ascii=False, indent=2) + ';')
        
        print(f"Successfully extracted {len(units)} units to data.js")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    extract_units_ultra_safe()
