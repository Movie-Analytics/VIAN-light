import logging
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

import config
import database as db

logger = logging.getLogger(__name__)

ALGORITHM = 'HS256'
pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
oauth2_scheme = OAuth2PasswordBearer(tokenUrl='token')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: timedelta|None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = (datetime.now(UTC) +
                  timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, config.SECRET_KEY, algorithm=ALGORITHM)


def get_current_account(token: str = Depends(oauth2_scheme)) -> db.Account:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail='Could not validate credentials',
        headers={'WWW-Authenticate': 'Bearer'},
    )
    try:
        payload = jwt.decode(token, config.SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get('sub')
        if email is None:
            logger.info('Failed login')
            raise credentials_exception
    except JWTError as e:
        logger.info('Failed login')
        raise credentials_exception from e

    with next(db.get_session()) as session:
        account = db.get_account_by_email(session, email)
        if account:
            return account
        else:
            logger.info('Failed login')
            raise credentials_exception

AccountDep = Annotated[db.Account, Depends(get_current_account)]
