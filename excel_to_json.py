import pandas as pd
import json

def excel_to_json(excel_file, output_file="output.json", sheet_name=0):
    try:
        df = pd.read_excel(excel_file, sheet_name=sheet_name)

        # Convert NaN to empty string
        df = df.fillna("")

        # 🔥 Convert Timestamp to string
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                df[col] = df[col].astype(str)

        data = df.to_dict(orient="records")

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=4, ensure_ascii=False)

        print(f" Successfully converted to {output_file}")

    except Exception as e:
        print(f" Error: {e}")

if __name__ == "__main__":
    excel_to_json("input.xlsx", "data.json")