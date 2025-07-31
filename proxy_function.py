import json
import os
import boto3

# Get the SQS queue URL from an environment variable
SQS_QUEUE_URL = os.getenv('SQS_QUEUE_URL')
if not SQS_QUEUE_URL:
    raise ValueError("SQS_QUEUE_URL environment variable not set.")

sqs_client = boto3.client('sqs')

def lambda_handler(event, context):
    try:
        # The body of the POST request from the Chrome extension API Gateway v2 (HTTP API) passes the body as a string.
        request_body = json.loads(event.get('body', '{}'))

        jwt_claims = event.get('requestContext', {}).get('authorizer', {}).get('jwt', {}).get('claims', {})
        user_email = jwt_claims.get('email')

        if not user_email:
            print("ERROR: User email not found in JWT claims.")
            return {
                'statusCode': 401,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Unauthorized: User email not found in token claims.'})
            }

        tabs = request_body.get('tabs', [])
        
        # Construct the message payload for the worker Lambda
        message_payload = {
            'user_email': user_email,
            'tabs': tabs
        }

        # Send the message to the SQS queue
        sqs_client.send_message(
            QueueUrl=SQS_QUEUE_URL,
            MessageBody=json.dumps(message_payload)
        )
        
        # Return an immediate success response to the user
        return {
            'statusCode': 202,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'message': 'Your request has been accepted and is being processed. You can close Chrome now.'})
        }

    except json.JSONDecodeError:
        print("ERROR: Invalid JSON in request body.")
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Bad Request: Invalid JSON format.'})
        }
    except Exception as e:
        print(f"ERROR: An unexpected error occurred: {e}")
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Internal Server Error'})
        }
