import os
from jose import JWTError, jwt
from fastapi import HTTPException, Header
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv('JWT_SECRET', 'random-key')
ALGORITHM = 'HS256'

async def verify_jwt(authorization: str = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail='No authorization header')
    
    try:
        scheme, token = authorization.split(' ')
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail='Invalid auth scheme')
    except ValueError:
        token = authorization  # allow raw token too
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        customer_id = payload.get('customer_id') or payload.get('sub')
        user_id = payload.get('id')
        if not user_id:
            raise HTTPException(status_code=401, detail='Invalid token payload')
        return {'customer_id': customer_id, 'user_id': user_id, 'payload': payload}
    except JWTError as e:
        raise HTTPException(status_code=401, detail=f'Token verification failed: {str(e)}')
