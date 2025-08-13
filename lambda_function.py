import json
import os
from dotenv import load_dotenv
from google import genai
from google.genai.types import Tool, GenerateContentConfig, UrlContext, GoogleSearch

load_dotenv()

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
SOURCE_EMAIL = os.getenv('SOURCE_EMAIL')

client = genai.Client(api_key=GEMINI_API_KEY)
model_id = "gemini-2.5-flash-lite"

url_context_tool = Tool(
    url_context = UrlContext
)
google_search_tool = Tool(
    google_search = GoogleSearch
)

# only keep title if it is a google search, keep both title and url if not (we presume it is a website)
def break_down_tab(tab):
    try:
        if tab['url'].startswith('https://www.google.com/search?q='):
            return {'title': tab['title'], 'url': None}
        else:
            return {'title': tab['title'], 'url': tab['url']}
    except KeyError as e:
        print(f"Missing key in tab: {e}")
        return {'title': tab.get('title', 'Unknown Title'), 'url': tab.get('url', 'Unknown URL')}
    
def generate_tab_content(title_and_url):
    try:
        print(f"Generating content for: {title_and_url}")
        if title_and_url['url'] is not None:
            response = client.models.generate_content(
                model=model_id,
                contents=f"If the link leads to a private page that requires login credentials or contains sensitive information and has security and privacy restrictions, completely ignore it, do not generate any response. Otherwise, generate a summary from {title_and_url['url']} and only include what is found on the page. State the page url {title_and_url['url']}",
                config=GenerateContentConfig(
                    tools=[url_context_tool],
                    response_modalities=["TEXT"],
                )
            )
        else:
            # For Google search titles
            response = client.models.generate_content(
                model=model_id,
                contents=f"You are an expert at giving me vast information about topics that I am interested in. Explain in simple but detailed terms like I am a beginner at the topic, if there are any abbreviations, explain them in the context of the topic. Tell me about {title_and_url.get('title', '')}. State that I explicitly searched {title_and_url.get('title', '')}",
                config=GenerateContentConfig(
                    tools=[google_search_tool],
                    response_modalities=["TEXT"],
                )
            )
        #result = response.candidates[0].content.parts
        return {'title': title_and_url['title'], 'url': title_and_url['url'], 'content': response.text}
    except Exception as e:
        print(f"Error generating content: {e}")
        return {'title': None, 'url': None, 'content': f"Error processing: {str(e)}"}
     
# TODO: implement gmail SMTP
# with the LLM responses, we pass them as a list to
def send_newsletter(tabs_content, recipient_email):
    divider = """
    
    """
    try:
        print("Generating newsletter...")
        # Convert map object to list and join content
        content_list = list(tabs_content)
        print(f"Content list length: {len(content_list)}")
        
        # conditionally add an anchor tag with the url if it is not None
        content_html = divider.join(
            (f"<h2><a href='{i['url']}'>{i['title']}</a></h2>" if i['url'] else f"<h2>{i['title']}</h2>") +
            f"<p>{i['content']}</p>"
            for i in content_list
        )

        

        return f"Newsletter sent to {recipient_email}"

    except Exception as e:
        print(f"Error generating newsletter: {e}")
        return f"Error generating newsletter: {str(e)}"
            

def lambda_handler(event, context):
    """
    This function is triggered by an SQS event. It processes messages
    containing user tabs, generates a newsletter, and sends it via SES.
    """
    print(f"Lambda triggered by SQS. Number of records: {len(event.get('Records', []))}")
    
    # Process each message from the SQS event
    for record in event.get('Records', []):
        try:
            # The message body from the proxy Lambda
            message_body = json.loads(record.get('body', '{}'))
            print(f"Processing message: {message_body}")

            user_email = message_body.get('user_email')
            tabs = message_body.get('tabs', [])

            if not user_email or not tabs:
                print("ERROR: Message is missing user_email or tabs. Skipping.")
                continue # Move to the next message

            # --- Your existing core logic starts here ---

            # Check if API keys are set
            error_msg = ""
            if not GEMINI_API_KEY:
                error_msg += "GEMINI_API_KEY not found. "
            if not SOURCE_EMAIL:
                error_msg += "SOURCE_EMAIL not found. "
            
            if error_msg:
                print(f"ERROR: {error_msg.strip()} not configured in environment variables. Aborting message processing.")
                # We continue to the next message instead of returning, 
                # so one misconfigured variable doesn't halt the whole batch.
                continue

            print(f"Starting newsletter generation for {user_email} with {len(tabs)} tabs.")

            # broken_down_tabs is an array of objects with title or url
            broken_down_tabs = list(map(break_down_tab, tabs))
            print(f"Broken down tabs: {broken_down_tabs}")
            
            tabs_content = map(generate_tab_content, broken_down_tabs)

            send_newsletter(tabs_content, user_email)

            print(f"Successfully processed message for {user_email}.")

        except json.JSONDecodeError as e:
            print(f"ERROR: Failed to decode JSON from SQS message body: {e}")
            # Malformed message, continue to the next one
            continue
        except Exception as e:
            print(f"CRITICAL ERROR processing a message: {e}")
            import traceback
            print(f"Traceback: {traceback.format_exc()}")
            # Depending on configuration, this failed message might be retried or sent to a DLQ.
            # We re-raise the exception to signal to SQS that this message failed processing.
            raise e