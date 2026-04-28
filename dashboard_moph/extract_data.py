import pandas as pd
import json
import os

def extract_units():
    file_path = '0 ผลการตรวจสอบรายการอัตราค่าบริการสาธารณสุขฯ.xlsx'
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return

    # Read the Excel file
    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        print(f"Error reading Excel: {e}")
        return

    # Map columns based on the observed structure
    # Expected Columns: [Province, Health Region, Unit Name, Unit Level]
    df.columns = ['province', 'region', 'name', 'type']
    
    # Filter out rows that don't have a name or are headers
    df = df[df['name'].notna()]
    df = df[df['name'] != 'หน่วยงาน']
    
    # Clean data
    units = []
    for _, row in df.iterrows():
        units.append({
            "province": str(row['province']).strip(),
            "name": str(row['name']).strip(),
            "type": str(row['type']).strip() if pd.notna(row['type']) else "",
            "status": 0, # Default: 0.ยังไม่ได้รับบัญชีอัตราค่าบริการ
            "startDate": "",
            "outcome": "",
            "updateDate": "",
            "fileLink": ""
        })

    with open('initial_data.json', 'w', encoding='utf-8') as f:
        json.dump(units, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully extracted {len(units)} units to initial_data.json")

if __name__ == "__main__":
    extract_units()
