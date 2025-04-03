import json
import logging
import shutil
import tempfile
import uuid
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import video_reader  # type: ignore
from celery import Celery, Task

import database as db
from config import (
    API_PREFIX,
    DATA_DIR,
    EXPORT_DIR,
    ONNXMODEL,
    REDIS_URL,
    SCREENSHOT_UPLOAD_DIR,
    SUBTITLE_UPLOAD_DIR,
    VIDEO_UPLOAD_DIR,
    get_path,
)

logger = logging.getLogger(__name__)

celery_app = Celery(
    __name__,
    broker=REDIS_URL,
    backend=REDIS_URL
)


class JobNotFoundException(Exception):
    pass


@celery_app.task(name='video info')
def get_video_info(video: str, job: int) -> dict|None:
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)  # type: ignore
        reader.open()
        fps = reader.get_frame_rate()

        db.update_job(session, job, status='DONE')
        db.create_result(session, job, {'fps': fps})
        return {'fps': fps}
    except Exception:
        logger.exception('Exception during video info')
        db.update_job(next(db.get_session()), job, status='ERROR')
        raise


@celery_app.task(name='shotboundary detection', bind=True)
def shotboundary_detection(self: Task, video: str, job: int) -> list|None:
    logger.info('Starting shotboundary detection')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)  # type: ignore
        reader.open()
        shots = reader.detect_shots(ONNXMODEL)

        if self.AsyncResult(self.request.id).state == 'REVOKED':
            db.update_job(session, job, status='CANCELED')
            return None

        db.update_job(session, job, status='DONE')
        db.create_result(session, job, shots)
        return shots
    except Exception:
        logger.exception('Exception during shotboundary detection')
        db.update_job(next(db.get_session()), job, status='ERROR')
        raise


@celery_app.task(name='screenshots generation', bind=True)
def screenshots_generation(
    self: Task,
    video: str,
    directory: str,
    frames: list[int],
    job: int
) -> list|None:
    logger.info('Starting screenshots generation')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)  # type: ignore
        reader.open()
        success = reader.generate_screenshots(str(DATA_DIR / directory), frames)

        if success != 0:
            db.update_job(session, job, status='ERROR')
            return None

        if self.AsyncResult(self.request.id).state == 'REVOKED':
            db.update_job(session, job, status='CANCELED')
            return None

        screenshots = [
            {
                'frame': frame,
                'thumbnail': (f'{API_PREFIX}{directory}/'
                              f'{str(frame).zfill(8)}_mini.jpg'),
                'image': f'{API_PREFIX}{directory}/{str(frame).zfill(8)}.jpg'
            }
            for frame in frames
        ]
        db.update_job(session, job, status='DONE')
        db.create_result(session, job, screenshots)
        return screenshots
    except Exception:
        logger.exception('Exception during screenshots generation')
        db.update_job(next(db.get_session()), job, status='ERROR')
        raise


@celery_app.task(name='screenshot generation')
def screenshot_generation(
    video: str,
    directory: str,
    frame: int,
    job: int
) -> dict|None:
    logger.info('Starting screenshot generation')
    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')

        reader = video_reader.VideoReader(video)  # type: ignore
        reader.open()
        success = reader.generate_screenshot(str(DATA_DIR / directory), frame)
        if success != 0:
            db.update_job(session, job, status='ERROR')
            return None

        screenshot = {
            'frame': frame,
            'thumbnail': (f'{API_PREFIX}{directory}/'
                          f'{str(frame).zfill(8)}_mini.jpg'),
            'image': f'{API_PREFIX}{directory}/{str(frame).zfill(8)}.jpg'
        }

        db.update_job(session, job, status='DONE')
        db.create_result(session, job, screenshot)
        return screenshot
    except Exception:
        db.update_job(next(db.get_session()), job, status='ERROR')
        logger.exception('Exception during screenshot generation')
        raise


@celery_app.task(name='export screenshot')
def export_screenshots(
    timelines: list[dict],
    frames: list[int]|None,
    fps: int,
    projectid: str,
    job: int
) -> str|None:
    logger.info('Starting screenshots export')

    def time_sec(t: float) -> str:
        hours = int(t / 3600)
        minutes = int((t % 3600) / 60)
        seconds = f'{(t % 60):.2f}'.replace('.', ',')
        return f'{hours:02}:{minutes:02}:{seconds}'

    try:
        session = next(db.get_session())
        db.update_job(session, job, status='RUNNING')
        zip_path = EXPORT_DIR / f'screenshots-{uuid.uuid4()}.zip'
        with ZipFile(DATA_DIR / zip_path, 'w', ZIP_DEFLATED) as zipf:
            for timeline in timelines:
                if not timeline['type'].startswith('screenshots'):
                    continue

                timeline_frames = [
                    f['image'].split('/')[-1]
                    for f in timeline['data']
                    if frames is None or f['frame'] in frames
                ]
                t_path = timeline['name'] + ' - ' + timeline['id']
                if len(timeline_frames) > 0:
                    zipf.mkdir(t_path)

                frame_dir = DATA_DIR / SCREENSHOT_UPLOAD_DIR / projectid
                for frame in timeline_frames:
                    frame_name = time_sec(int(frame.removesuffix('.jpg'))/fps) + '.jpg'
                    zipf.write(
                        frame_dir / frame,
                        t_path + '/' + frame_name
                    )
        zip_path = API_PREFIX + str(zip_path)
        db.update_job(session, job, status='DONE')
        db.create_result(session, job, zip_path)
        return zip_path
    except Exception:
        db.update_job(next(db.get_session()), job, status='ERROR')
        logger.exception('Exception during screenshot export')
        raise


@celery_app.task(name='export project')
def export_project(projectid: str, jobid: int) -> str|None:
    try:
        session = next(db.get_session())
        job = db.get_job(session, None, jobid)
        if job is None:
            raise JobNotFoundException(jobid)
        zipname = f'{uuid.uuid4()}.zip'
        zippath = get_path(EXPORT_DIR) / zipname

        with ZipFile(zippath, 'w', ZIP_DEFLATED) as zipf:
            undoable = db.load_store(session, job.account, 'undoable', projectid)
            if undoable is not None:
                zipf.writestr('undoable.json', undoable.data)

                undoable_data = json.loads(undoable.data)
                if undoable_data['subtitles'] is not None:
                    filename = undoable_data['subtitles'].split('/')[-1]
                    zipf.write(
                        get_path(SUBTITLE_UPLOAD_DIR) / filename,
                        'subtitles.vtt'
                    )

            main = db.load_store(session, job.account, 'main', projectid)
            if main is not None:
                zipf.writestr('main.json', main.data)

            screenshotpath = get_path(SCREENSHOT_UPLOAD_DIR) / job.project_id
            if screenshotpath.exists():
                for screenshot in screenshotpath.glob('*'):
                    zipf.write(screenshot, 'screenshots/' + screenshot.name)

        zip_url = API_PREFIX + str(EXPORT_DIR / zipname)
        db.update_job(session, jobid, status='DONE')
        db.create_result(session, jobid, zip_url)
        return zip_url
    except Exception:
        db.update_job(next(db.get_session()), jobid, status='ERROR')
        logger.exception('Exception during project export')
        raise


@celery_app.task(name='import project')
def import_project(video: str, zipfile: str, project_id: str, jobid: int) -> dict:
    try:
        session = next(db.get_session())
        unique_filename = f'{uuid.uuid4()}.mp4'
        full_file_path = get_path(VIDEO_UPLOAD_DIR) / unique_filename
        job = db.get_job(session, None, jobid)
        if job is None:
            raise JobNotFoundException(jobid)

        shutil.move(video, full_file_path)
        zippath = Path(zipfile)

        project_name = zippath.name

        with tempfile.TemporaryDirectory() as tmpdirname:
            tmpdir = Path(tmpdirname)
            with ZipFile(zippath) as zip_ref:
                zip_ref.extractall(tmpdir)

            with (tmpdir / 'main.json').open() as f:
                store = json.load(f)
                store['video'] = API_PREFIX + str(VIDEO_UPLOAD_DIR / unique_filename)
                store['id'] = project_id
                db.save_store(session, job.account, 'main', project_id, store)

            if (tmpdir / 'screenshots').exists():
                shutil.move(
                    tmpdir / 'screenshots',
                    get_path(SCREENSHOT_UPLOAD_DIR) / project_id
                )

            with (tmpdir / 'undoable.json').open() as f:
                store = json.load(f)

            if (tmpdir / 'subtitles.vtt').exists():
                subtitle = str(uuid.uuid4())
                shutil.move(
                    tmpdir / 'subtitles.vtt',
                    get_path(SUBTITLE_UPLOAD_DIR) / f'{subtitle}.vtt'
                )

            store['id'] = project_id
            db.save_store(session, job.account, 'undoable', project_id, store)

        shutil.rmtree(zippath.parent)
        result = {'id': project_id, 'name': project_name}
        db.update_job(session, jobid, status='DONE')
        db.create_result(session, jobid, result)
        return result
    except Exception:
        db.update_job(next(db.get_session()), jobid, status='ERROR')
        logger.exception('Exception during project import')
        raise
