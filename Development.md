# Development

## Implementation

### General Structure
Electron application consist of a backend and frontend. The backend uses node.js and lives in `src/main`. The `src/main/index.js` file is the entrypoint for the application which creates the window, etc. The frontend is in `src/renderer` and uses vue.js with Vuetify. The communication between frontend and backend is described in `src/preload/index.js`. It defines methods which can be called. For security reasons, the frontend cannot just send anything to the backend. File pickers, file system access, etc. are all backend tasks. Web workers (in `src/main/workers`) are used for longer running tasks (e.g. shotboundary detection).

VIAN works as a website as well. A Python FastAPI backend can be used instead of the Node.js backend. The Python code is in `server`. It can be run directly or with docker. The docker files (including docker-compose file) are in `docker`. The frontend has an abstraction `api.js` which switches the API call depending on the environment. Calls either use `fetch` to retrieve from the FastAPI backend or they call the Node.js backend. There are some other small functionalities which depend on Electron/Web environment (e.g. the login view is only required in web) but most of it is contained in `api.js`.


### Shortcuts
The shortcuts shown in the menu above are indepent from the actual shortcuts. They are shown there for the user by the Node.js backend. However, using those would interfere with the writing text into inputs and would also not work on the web. This is why the actual shortcuts are implemented with an onkeyup listener in `shortcuts.js`.


### Timeline Data Structure
There are four types of timelines
- `shots`
- `screenshots`
- `screenshots-manual`
- `scalar`


### Timeline
The timeline uses an HTML canvas with d3.js. For a >2 hours movie and several timelines, there can be a lot of elements on the timeline which is why performance is critical. In general there are three canvas elements. The `timeCanvas` which displays the axis with the time codes, the main `canvas` with all the segments and images and the `hiddenCanvas` which is used for picking. To retrieve the clicked element, it is common to have second canvas with the same elements, where each element gets a different color. The color under the mouse can then be used to match it back to the element. You can see this when changing the `display` css value of the hiddenCanvas to inspect it.
To speed up the performance, the canvas uses e.g.:
- `markRaw` for the data, to prevent vue's wrappers
- Uses objects directly (`const { hCtx, ctx, data } = this`) and not via `this.ctx` since it is faster
- Draws with `requestAnimationFrame`

Using `OffscreenCanvas` could be another way to improve performance in the future but the interaction (passing data and events) is not trivial.


### C++ Code
The C++ code has a wrapper for both Python and Node.js. It is used to extract information from the video, generate the screenshots and run the shotboundary detection. It needs to be statically compiled to run on different platforms without running into missing linked libraries. There is a [separate repository](https://github.com/Movie-Analytics/ffmpeg-build) for compiling ffmpeg. We use a pre-compiled ONNX to run the shotboundary detection model TransNetv2. We currently rely on an older ONNX version because there were build issues with newer versions. The inference happens on the CPU and is relatively slow currently.

The node C++ build can be compiled and run with the following commands:
```
$ npx node-gyp clean
$ npx node-gyp configure
$ npx node-gyp build
```

Running `uv sync` compiles it for Python.

The termination of tasks is currently implemented with QueueWorker for Node.js and with a signal handler for Python which catches SIGTERM sent via Celery.


### Pinia Stores
There are 5 pinia stores, which try to catpure different storing functionality:
- `meta.js` - This store contains the information about which projects exists and how they are called. It is mostly used for displaying them in `src/renderer/src/pages/index.vue`
- `main.js` - This store exists per project. It contains general information which does not get changed by the user, e.g. frame rate, video duration, or location of the video. There is no undo functionality for this store.
- `undoable.js` - This store also exists per project. It contains information which gets changed by the user like timelines and annotations. Every change here is tracked and creates a copy in `undo.js`.
- `undo.js` - This store also exists per project. It is not persistent. It provides undo and redo functionality.
- `temp.js` - This store also exists per project. It is not persistent and contains information like current selection, position of the player or which timelines are expanded.

The stores track their changes and store them on every change automatically to the file system (this is done in each store with `this.$subscribe((mutation, state) => {...`) as JSON. It turned out, however, that this can lead to timing issues in rare cases.
The stores are also stored as JSON in the Python backend but in a database and not directly on the file system.


## Project folder
The project files are stored here:
- Linux: `~/.config/VIAN-light/vian-light/`
- Windows: `'C:\Users\USERNAME\AppData\Roaming\VIAN-light\vian-light\`
- Mac OS: `~/Library/Application Support/VIAN-light/vian-light/`


### Python Backend
The Python backend runs tasks via celery. The database is e.g. SQLite or PostgreSQL. All the project information like jobs or stores are tied to user accounts and stored in the database. Video, screenshots, subtitles and exported files are stored with a unique ID in the `uploads` directory.

The Python code uses `uv` for dependency management. Run `uv sync` to update the dependencies. This should also compile the C++ code for usage in python.


## Building on Mac OS
If you are using Mac OS and don't want to notarize, set `notarize` to `false` in `electron-builder.yml`.

If you do want to sign and notarize, you have to set the following environment variables:

for signing:

- CSC_KEY_PASSWORD
- CSC_LINK (file path to the p12 certificate which must include private key)

for notarization:

- APPLE_APP_SPECIFIC_PASSWORD
- APPLE_ID
- APPLE_TEAM_ID


## Steps to Release a New Version
- Set the version in package.json
- Create a draft release in github with the same version as in the package.json
- Run the build_electron action in github. It automatically attaches the builds (e.g. vian-light.dmg) to the draft release.
- Publish the release.


## Linting
VIAN has linters for Python and Javascript configured. They run on every commit as Github Actions. There is currently `ruff` and `pyright` for Python, as well as `eslint` for Javascript.
There are currently no tests 🥲.


## General Advice and Limitations
The timelines data structure is a bottleneck. It makes sense to have a long (~2 hours) movie with multiple timelines (>10) to test the performance impact of changes and print rendering time in the console. Especially watchers on the datastructure are quite expensive.

The C++ code is not in the best state. On Mac OS, there can be warnings when terminating the application which is caused by the C++ code (maybe issues with freeing the memory).

