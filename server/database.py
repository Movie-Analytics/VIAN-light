import datetime
import json
from collections.abc import Iterator, Sequence
from typing import Annotated

import sqlalchemy
from fastapi import Depends
from sqlmodel import Field, Relationship, Session, SQLModel, create_engine, select

import config

engine = create_engine(config.DATABASE_URL)

def create_db_and_tables() -> None:
    try:
        SQLModel.metadata.create_all(bind=engine, checkfirst=True)
    except sqlalchemy.exc.IntegrityError as e:
        # with multiple workers this can create an error because all of them
        # try to create the same tables
        if 'duplicate key value' not in str(e):
            raise


def get_session() -> Iterator[Session]:
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]


class Account(SQLModel, table=True):
    id: int|None = Field(default=None, primary_key=True)
    email: str
    password: str

    stores: list['Store'] = Relationship(back_populates='account')
    jobs: list['Job'] = Relationship(back_populates='account')


class Store(SQLModel, table=True):
    id: int|None = Field(default=None, primary_key=True)
    project_id: str|None
    name: str
    data: str
    account_id: int|None = Field(foreign_key='account.id')

    account: Account = Relationship(back_populates='stores')


class Job(SQLModel, table=True):
    id: int|None = Field(default=None, primary_key=True)
    account_id: int|None = Field(foreign_key='account.id')
    project_id: str
    creation: datetime.datetime
    type: str
    status: str
    worker: str|None

    account: Account = Relationship(back_populates='jobs')
    results: list['Result'] = Relationship(back_populates='job')


class Result(SQLModel, table=True):
    id: int|None = Field(default=None, primary_key=True)
    job_id: int|None = Field(foreign_key='job.id')
    data: str|None

    job: Job = Relationship(back_populates='results')


def get_account_by_email(session: Session, email: str) -> Account|None:
    return session.exec(select(Account).where(Account.email == email)).first()


def create_account(session: Session, email: str, password: str) -> Account:
    account = Account(
        email=email,
        password=password
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


def save_store(
    session: Session,
    current_account: Account,
    name: str,
    projectid: str|None,
    data: dict
) -> Store:
    statement = select(Store).where(Store.account_id==current_account.id,
                                    Store.name==name,
                                    Store.project_id==projectid)
    store = session.exec(statement).first()
    if store:
        store.data = json.dumps(data)
    else:
        store = Store(
            project_id=projectid,
            name=name,
            data=json.dumps(data),
            account_id=current_account.id,
        )
    session.add(store)
    session.commit()
    session.refresh(store)
    return store


def load_store(
    session: Session,
    current_account: Account,
    name: str,
    projectid: str|None
) -> Store|None:
    statement = select(Store).where(Store.account_id==current_account.id,
                                    Store.name==name,
                                    Store.project_id==projectid)
    return session.exec(statement).first()


def get_jobs(
    session: Session,
    current_account: Account,
    projectid: str
) -> Sequence[Job]:
    statement = select(Job).where(Job.account_id==current_account.id,
                                  Job.project_id == projectid)
    return session.exec(statement).all()


def create_job(
    session: Session,
    current_account: Account,
    name: str,
    projectid: str,
    worker: str|None = None
) -> Job:
    job = Job(
        account_id=current_account.id,
        creation=datetime.datetime.now(),
        type=name,
        project_id=projectid,
        status='QUEUED',
        worker=worker
    )
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def update_job(
    session: Session,
    jobid: int|None,
    status: str|None = None,
    worker: str|None = None
) -> None:
    if jobid is None:
        return
    statement = select(Job).where(Job.id==jobid)
    job = session.exec(statement).first()
    if job is not None and status is not None:
        job.status = status
    if job is not None and worker is not None:
        job.worker = worker
    session.add(job)
    session.commit()
    session.refresh(job)


def get_result(session: Session, current_account: Account, jobid: int) -> Result|None:
    statement = select(Result).join(Job).where(Job.account_id == current_account.id,
                                               Result.job_id == jobid)
    result = session.exec(statement).first()
    if result is not None and result.data is not None:
        result.data = json.loads(result.data)
    return result


def create_result(session: Session, jobid: int, data: dict|list|str) -> Result:
    result = Result(
        job_id=jobid,
        data=json.dumps(data)
    )
    session.add(result)
    session.commit()
    session.refresh(result)
    return result


def get_job(session: Session, account: Account, jobid: int) -> Job|None:
    statement = select(Job).where(Job.account_id == account.id,
                                  Job.id == jobid)
    return session.exec(statement).first()
