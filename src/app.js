const { app, BrowserWindow, Menu, ipcMain, dialog, Notification, shell } = require('electron')
const prompt = require('electron-prompt');
const path = require('path')
const fs = require('fs')
const sharp = require('sharp');
const archiver = require('archiver');

// So that images are freed from the system after using them
sharp.cache(false)

function emptyCollectionObj() {
    return { articles: [] }
}

var mainWindow;
var working_path = `${path.join(require("os").homedir(), '/Documents')}`
var working_file;

app.whenReady().then(() => {
    const createWindwow = () => {
        mainWindow = new BrowserWindow({
            title: "Template Maker",
            width: 1050,
            height: 700,
            minWidth: 700,
            minHeight: 700,
            icon: './assets/SolveIt-Logo.ico',
            maximizable: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            },
        })

        mainWindow.toggleDevTools();
        mainWindow.once("ready-to-show", () => {
            mainWindow.maximize()
            openFile(path.join(__dirname, "../testing_project"))
        })

        mainWindow.loadFile('./src/index.html')

        // Kill the app when main Window closed
        mainWindow.on('closed', function () {
            app.quit()
        })

        // Create the menu object and add it to the application
        const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)
        Menu.setApplicationMenu(mainMenu)
    }

    createWindwow()

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
})

app.setAboutPanelOptions({
    applicationName: "Template Maker",
    applicationVersion: app.getVersion(),
    authors: ["Mateo Aberastury"],
    iconPath: "./assets/SolveIt Logo.png"
})

app.setName("Template Maker")


ipcMain.on('save-request', (e, data) => {
    writeToFile(data);
})

// The response from the file:save request made to the webWindow
ipcMain.on('file:save-response', (e, data) => {
    writeToFile(data)
    notify("Successfully Saved Progress")
})

// New Title Request
ipcMain.on('ask-title', () => {
    prompt({
        title: "Enter the Article's title",
        label: 'Title:',
        type: 'input'
    })
        .then((r) => {
            if (r === null) {
                mainWindow.webContents.send('title-response', "empty")
            } else {
                mainWindow.webContents.send('title-response', r)
            }
        })
})

// Image Selection request
ipcMain.handle('select-image', async () => {
    let img_path = dialog.showOpenDialogSync({
        title: "Select an image",
        filters: [
            { name: 'Images', extensions: ['jpg', 'png', 'jpeg', 'webp'] },
            { name: 'All Files', extensions: ['*'] }
        ],
        properties: [
            'openFile'
        ],
        defaultPath: working_path
    })

    if (img_path === undefined)
        return { rel: '', abs: '' }
    else
        img_path = `${img_path}`

    let relative_path = `${path.relative(working_path, img_path)}`
    let image_name = path.basename(img_path)

    // Users might select a file that's outside the supposed folder
    // In that case, file must be moved (or saved sharp) to a sub-folder

    const img = await sharp(img_path)
    const meta = await img.metadata()
    let new_img_path = img_path

    const adjust_img_path = () => {
        if (!fs.existsSync(path.join(working_path, "src"))) {
            fs.mkdirSync(path.join(working_path, "src"), { recursive: true })
        }
        new_img_path = path.join(working_path, 'src', image_name)
    }

    if (relative_path.startsWith('..')) {
        adjust_img_path()
    }
    if (meta.format === 'webp') {
        new_img_path = new_img_path.replace('.webp', '.jpeg')
        await img.resize(1080, 1350, { fit: "outside" }).toFile(new_img_path)
        fs.rm(img_path, (e) => { if (e) console.log(e) })
    } else if (meta.width > 1080 && meta.height > 1350) {
        // Only add the _s to the file name if it doesn't exist in the same directory 
        // because sharp cannot overwrite to the same file
        if (fs.existsSync(new_img_path) && new_img_path === img_path) {
            new_img_path = new_img_path.split('.')
            new_img_path[new_img_path.length - 2] = new_img_path[new_img_path.length - 2] + '_s'
            new_img_path = new_img_path.join('.')
        }

        await img.resize(1080, 1350, { fit: "outside" }).toFile(new_img_path)
        fs.rm(img_path, (e) => { if (e) console.log(e) })
    } else if (relative_path.startsWith('..')) {
        fs.renameSync(img_path, new_img_path)
    }

    // Until it is all HTML, don't send the relative path but move it out of the way
    return { rel: new_img_path, abs: `${new_img_path}` }
})

// Get the control key - OS Dependent
const ctrl = (process.platform == 'darwin') ? 'Command' : 'Ctrl'

const mainMenuTemplate = [
    ...(process.platform === 'darwin' ? [{ label: app.name }] : []),
    {
        label: '&File',
        submenu: [
            {
                label: 'Open',
                accelerator: `${ctrl}+O`,
                click() {
                    openFile()
                }
            },
            {
                label: 'Save',
                accelerator: `${ctrl}+S`,
                click() {
                    sendDataRequest();
                }
            },
            {
                label: 'Export To Zip',
                accelerator: `${ctrl}+E`,
                click() {
                    mainWindow.webContents.send('export-request')
                    ipcMain.once('export-response', (e, data) => {
                        writeToFile(data)
                        let zip_path = path.join(working_path, 'SHARE_THIS.zip')
                        const output = fs.createWriteStream(zip_path);
                        const archive = archiver('zip');

                        output.on('close', () => {
                            notify("Succesfully Exported", `Saved to: ${zip_path}`)
                            shell.showItemInFolder(zip_path)
                        });


                        // pipe archive data to the file
                        archive.pipe(output);

                        // good practice to catch warnings (ie stat failures and other non-blocking errors)
                        archive.on('warning', function (err) {
                            if (err.code === 'ENOENT') {
                                console.log(err)
                            } else {
                                // throw error
                                throw err;
                            }
                        });

                        // good practice to catch this error explicitly
                        archive.on('error', function (err) {
                            throw err;
                        });

                        const sub_folder = Math.random().toString(36).substring(2, 10)
                        archive.file(working_file, { name: `${sub_folder}/collection.json` })
                        for (let article of data.articles) {
                            for (let i in article.slides) {
                                archive.file(path.join(working_path, article.slides[i].img.src), { name: `${sub_folder}/${article.slides[i].img.src}` })
                            }
                        }

                        archive.finalize()
                    })
                }
            },
            {
                label: 'Qui App',
                accelerator: `${ctrl}+Q`,
                click() {
                    app.quit()
                }
            }
        ]
    },
    {
        label: "&Edit",
        submenu: [
            {
                label: "New Article",
                accelerator: `${ctrl}+N`,
                click() {
                    mainWindow.webContents.send('make-article')
                }
            },
            {
                label: "Remove Article",
                accelerator: `Alt+Backspace`,
                click() {
                    mainWindow.webContents.send('remove-article')
                }
            },
            {
                label: "New Slide",
                accelerator: `${ctrl}+Shift+N`,
                click() {
                    mainWindow.webContents.send('make-slide')
                }
            }, ,
            {
                label: "Remove Slide",
                accelerator: `Alt+Shift+Backspace`,
                click() {
                    mainWindow.webContents.send('remove-slide')
                }
            },
            {
                label: "Move Slide Down",
                accelerator: `Alt+Down`,
                click() {
                    mainWindow.webContents.send('move-slide-down')
                }
            },
            {
                label: "Move Slide Up",
                accelerator: `Alt+Up`,
                click() {
                    mainWindow.webContents.send('move-slide-up')
                }
            }
        ]
    },
    {
        label: "About",
        role: "about"
    }
]

// Add empty space if on Mac
if (process.platform == 'darwin') {
    mainMenuTemplate.unshift({})
}

// Will only send the save-request
function sendDataRequest() {
    mainWindow.webContents.send('file:save-request')
}

// Open a folder and create collection.json if needed (else load it)
function openFile(path_to_open = undefined) {
    if(path_to_open == undefined){
        path_to_open = dialog.showOpenDialogSync({
            title: "Select an folder",
            properties: [
                'openDirectory'
            ],
            defaultPath: working_path
        })[0]
    }
    if (path_to_open != undefined) {
        working_path = (path.extname(path_to_open) === '') ? path_to_open : path.dirname(path_to_open)
        working_file = (path.extname(path_to_open) === '.json') ? path_to_open : path.join(working_path, "collection.json")
        fs.readFile(working_file, { encoding: 'utf16le' }, (err, data) => {
            if (err) {
                let data = emptyCollectionObj();
                writeToFile(data, (err) => {
                    if (err)
                        console.log(err)
                    else
                        mainWindow.webContents.send('file:opened', data, working_path)
                })
            } else {
                mainWindow.webContents.send('file:opened', JSON.parse(data), working_path)
            }
        })
    }
}

// Write the JSON data to the file as a string
function writeToFile(data, handler = (err) => {
    if (err) { console.log(err) }
}) {
    fs.writeFile(working_file, JSON.stringify(data), 'utf16le', handler)
}

function notify(title, body) {
    new Notification({ title: title, body: body }).show()
}