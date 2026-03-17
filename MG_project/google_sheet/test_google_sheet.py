import os
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

# 1. 配置信息
SERVICE_ACCOUNT_FILE = 'MG_project/google_sheet/credentials.json' # 你下载的密钥文件
SCOPES = ['https://www.googleapis.com/auth/drive.readonly'] # 只需要读取权限

# 你的 Google 表格 ID (从 URL 中获取: https://docs.google.com/spreadsheets/d/表格ID/edit)
SPREADSHEET_ID = '1ZCmZ7xQ8gv6uuLK5S1yrhxmjCPptVHUkgwjJuRwYyag' 
OUTPUT_FILE = './DataConfig/Raw/String.xlsx'

def download_google_sheet_as_excel(file_id, output_path):
    # 验证权限
    creds = service_account.Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    
    # 构建 Drive 服务（导出功能属于 Drive API，读取内容属于 Sheets API）
    service = build('drive', 'v3', credentials=creds)

    # 发起导出请求 (将 Google Sheets 转换为 Office Open XML 格式)
    request = service.files().export_media(
        fileId=file_id,
        mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )

    # 下载文件流
    fh = io.BytesIO()
    downloader = MediaIoBaseDownload(fh, request)
    done = False
    print(f"开始同步文档: {file_id} ...")
    
    while done is False:
        status, done = downloader.next_chunk()
        print(f"下载进度: {int(status.progress() * 100)}%")

    # 写入本地文件
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with open(output_path, 'wb') as f:
            f.write(fh.getvalue())
        print(f"同步成功！已保存至: {output_path}")
    except PermissionError:
        print(f"无法写入文件: {output_path}")
        print("请关闭 Excel 中打开的该文件后重试。")

if __name__ == "__main__":
    download_google_sheet_as_excel(SPREADSHEET_ID, OUTPUT_FILE)