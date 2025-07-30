import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai.types import Tool, GenerateContentConfig, UrlContext, GoogleSearch

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=GEMINI_API_KEY)
model_id = "gemini-2.5-flash-lite"

url_context_tool = Tool(
    url_context = UrlContext
)
google_search_tool = Tool(
    google_search = GoogleSearch
)

# keep title if it is a google search, keep url if not (we presume it is a website)
def break_down_tab(tab):
    try:
        if tab['url'].startswith('https://www.google.com/search?q='):
            return {'title': tab['title']}
        else:
            return {'url': tab['url']}
    except KeyError as e:
        print(f"Missing key in tab: {e}")
        return {'url': tab.get('url', 'Unknown URL')}
    
def generate_tab_content(title_or_url):
    try:
        print(f"Generating content for: {title_or_url}")
        if 'url' in title_or_url:
            response = client.models.generate_content(
                model=model_id,
                contents="Generate a summary from " + title_or_url['url'],
                config=GenerateContentConfig(
                    tools=[url_context_tool],
                    response_modalities=["TEXT"],
                )
            )
        else:
            # For Google search titles
            response = client.models.generate_content(
                model=model_id,
                contents=f"Give me three day events schedule based on this search: {title_or_url.get('title', '')}. Also let me know what needs to taken care of considering weather and commute.",
                config=GenerateContentConfig(
                    tools=[google_search_tool],
                    response_modalities=["TEXT"],
                )
            )
        result = response.candidates[0].content.parts.text
        print(f"Generated content length: {len(result)}")
        return result
    except Exception as e:
        print(f"Error generating content: {e}")
        return f"Error processing: {str(e)}"
    
# with the LLM responses, we pass them back to the LLM to put together into a newsletter
def generate_newsletter(tabs_content):
    try:
        print("Generating newsletter...")
        # Convert map object to list and join content
        content_list = list(tabs_content)
        print(f"Content list length: {len(content_list)}")
        combined_content = "\n\n".join(content_list)
        print(f"Combined content length: {len(combined_content)}")
        
        response = client.models.generate_content(
            model=model_id,
            contents=f"Put together the following individual parts content into a newsletter. Don't generate a title, just put together the content:\n\n{combined_content}",
            config=GenerateContentConfig(
                tools=[],
                response_modalities=["TEXT"],
            )
        )
        result = response.candidates[0].content.parts.text
        print(f"Newsletter generated, length: {len(result)}")
        return result
    except Exception as e:
        print(f"Error generating newsletter: {e}")
        return f"Error generating newsletter: {str(e)}"
            

def lambda_handler(event, context):
    print(f"Lambda started with method: {event['requestContext']['http']['method']}")
    print(f"Event body: {event.get('body', 'No body')}")
    
    method = event['requestContext']['http']['method']
    
    if method == 'POST':
        try:
            print("Processing POST request...")
            
            # Check if GEMINI_API_KEY is set
            if not GEMINI_API_KEY:
                print("ERROR: GEMINI_API_KEY not found in environment variables")
                return {
                    'statusCode': 500,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'GEMINI_API_KEY not configured', 'success': False})
                }
            
            # get tabs info and break it down such that it is useable
            body = json.loads(event.get('body', '{}'))
            print(f"Parsed body: {body}")
            
            tabs = body.get('tabs', [])
            print(f"Number of tabs: {len(tabs)}")
            
            if not tabs:
                print("No tabs provided")
                return {
                    'statusCode': 400,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'No tabs provided', 'success': False})
                }
            
            # broken_down_tabs is an array of objects with title or url
            broken_down_tabs = list(map(break_down_tab, tabs))
            print(f"Broken down tabs: {broken_down_tabs}")
            
            tabs_content = map(generate_tab_content, broken_down_tabs)

            newsletter = generate_newsletter(tabs_content)
            print("Newsletter generation completed")
            # send the email newsletter to the user

            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'message': f"newsletter: {newsletter}",
                    'success': True
                })
            }
        except Exception as e:
            print(f"Lambda error: {e}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            return {
                'statusCode': 500,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': f'Internal server error: {str(e)}', 'success': False})
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