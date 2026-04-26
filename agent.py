import google.generativeai as genai

genai.configure(api_key="AIzaSyC88UxB7GBPLKvqWtTjXf3H3xLmtTw2t4g")

# 'code_execution' 도구를 탑재한 에이전트 모델 설정
model = genai.GenerativeModel(
    model_name='gemini-1.5-flash',
    tools='code_execution'
)

# 에이전트에게 명령 전달
command = input()
response = model.generate_content(command)
print(response.text)