import json
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GEMINI_API_KEY)

def lambda_handler(event, context):
    method = event['requestContext']['http']['method']
    
    if method == 'POST':
        # get tabs info and break it down such that it is useable
        body = json.loads(event.get('body', '{}'))
        tabs = body['tabs']
        # keep title if it is a google search, keep url if not (we presume it is a website)
        def break_down_tab(tab):
            if tab['url'].startswith('https://www.google.com/search?q='):
                return {'title': tab['title']}
            else:
                return {'url': tab['url']}
        broken_down_tabs = map(break_down_tab, tabs)

        # with the LLM responses, we pass them back to the LLM to put together into a newsletter
        # send the email newsletter to the user


        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'message': f"Received POST data: {body}",
                'success': True
            })
        }
    
    else:
        return {
            'statusCode': 405,
            'headers': {
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'error': 'Method Not Allowed',
                'success': False
            })
        }