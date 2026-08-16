import os
import json
from flask import Flask, render_template, request, jsonify
from config import Config
from agents.orchestrator import TranslationOrchestrator

app = Flask(__name__)
app.config.from_object(Config)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/process', methods=['POST'])
def process_subtitles():
    try:
        target_language = request.form.get('target_language', app.config['DEFAULT_TARGET_LANGUAGE'])
        speed_factor = float(request.form.get('speed_factor', 1.0))

        orchestrator = TranslationOrchestrator(
            api_key=app.config['DEFAULT_GEMINI_API_KEY'],
            model_name=app.config['DEFAULT_MODEL_NAME'],
            fps=app.config['DEFAULT_FPS']
        )

        base_name = "subtitles"

        # Option 1: File Upload (.json or .srt)
        if 'file' in request.files and request.files['file'].filename != '':
            uploaded_file = request.files['file']
            filename = uploaded_file.filename
            base_name = os.path.splitext(filename)[0]
            filename_lower = filename.lower()
            file_content = uploaded_file.read().decode('utf-8')

            if filename_lower.endswith('.srt'):
                result = orchestrator.process_srt_text(
                    srt_text=file_content,
                    target_language=target_language,
                    speed_multiplier=speed_factor
                )
            else:
                try:
                    json_data = json.loads(file_content)
                    result = orchestrator.process_draft_json(
                        json_data=json_data,
                        target_language=target_language,
                        speed_multiplier=speed_factor
                    )
                except json.JSONDecodeError:
                    if '-->' in file_content:
                        result = orchestrator.process_srt_text(
                            srt_text=file_content,
                            target_language=target_language,
                            speed_multiplier=speed_factor
                        )
                    else:
                        raise

        # Option 2: Text Paste (JSON or SRT)
        elif request.form.get('json_text'):
            pasted_text = request.form.get('json_text').strip()
            if '-->' in pasted_text and not pasted_text.startswith('{'):
                result = orchestrator.process_srt_text(
                    srt_text=pasted_text,
                    target_language=target_language,
                    speed_multiplier=speed_factor
                )
            else:
                json_data = json.loads(pasted_text)
                result = orchestrator.process_draft_json(
                    json_data=json_data,
                    target_language=target_language,
                    speed_multiplier=speed_factor
                )
        else:
            return jsonify({
                "success": False,
                "error": "Vui lòng tải lên file JSON / SRT hoặc dán nội dung văn bản."
            }), 400

        result['filename_base'] = base_name
        return jsonify(result)

    except json.JSONDecodeError:
        return jsonify({
            "success": False,
            "error": "File hoặc cú pháp không hợp lệ. Vui lòng kiểm tra lại cấu trúc file draft_content.json hoặc file .srt!"
        }), 400
    except Exception as e:
        return jsonify({
            "success": False,
            "error": f"Lỗi hệ thống: {str(e)}"
        }), 500

if __name__ == '__main__':
    print("=" * 60)
    print("CAPCUT SRT AGENT FLASK WEB APPLICATION STARTING...")
    print("Truy cap ung dung tai: http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host='0.0.0.0', port=5000, debug=True)