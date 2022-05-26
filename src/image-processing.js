const fabric = require("fabric").fabric

const canvas = new fabric.Canvas('output-img', {
    preserveObjectStacking: true
});
const smallBkBlur = new fabric.Image.filters.Blur({ blur: 0.15, clipName: 'blur' });

const SCALE = canvas.getHeight() / 1350;
const CORNER_RADIUS = 43.2;
const MARGIN = 47;
const TXT_PADDING = MARGIN / 2;
const IMAGE_HEIGHT = 1350;
const IMAGE_WIDTH = 1080;
const MAX_RECT_WIDTH = IMAGE_WIDTH - MARGIN * 2

var logo;
fabric.Image.fromURL(
    './SolveIt Logo.png',
    img => {
        img.scaleToHeight(31 * SCALE)
        logo = img
    }, {
    selectable: false,
    top: canvas.getHeight() - 31 * 1.5 * SCALE,
    left: canvas.getWidth() - 31 * 1.5 * SCALE,
})

// FabricJs Object of the current image
var bkImageFabricGroup;
// FabricJs Object of the current blurred background
var blBkImageFabric;
// The FabricJS Object Containing the Title
var title_txt_box;
// The FabricJS Object Containing the Contents of the slide
var content_txt_box;
// The FabricJS Object Containing the Contents' Boxes
var title_bounding_box
var content_bounding_box;

// Last object status
var prevObj;

// This will update the image preview (no blur behind text)
function updateImagePreview(new_slide_obj) {
    return new Promise((res, rej) => {
        // This will be done last, it is where the promise will be resolved
        const updateCanvas = () => {
            canvas.clear()
            if (blBkImageFabric !== undefined &&
                (new_slide_obj.img.hide_blr_bk === undefined || new_slide_obj.img.hide_blr_bk === false)) {
                canvas.add(blBkImageFabric)
            }

            canvas.add(bkImageFabricGroup)
            addTextToCanvas(new_slide_obj)

            canvas.add(logo)

            res(true)
        };

        if (prevObj?.img?.src !== new_slide_obj.img.src) {
            let async_counter = 2;

            // Will need to update both images
            updateBkImageGroup(new_slide_obj, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })

            updateBlBkImageFabric(new_slide_obj, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })
        } else if (prevObj?.img?.reverse_fit !== new_slide_obj.img.reverse_fit) {
            updateBkImageGroup(new_slide_obj, updateCanvas)
        } else {
            updateCanvas()
        }

        prevObj = structuredClone(new_slide_obj)
    })

}

function loadFromJSON(slide_obj) {
    if (slide_obj.fabric !== undefined) {
        canvas.loadFromJSON(slide_obj.fabric)
    } else {
        updateImagePreview(slide_obj)
    }
}

function exportSlideToFile(slide_obj) {
    updateImagePreview(slide_obj).then(result => {
        canvas.toDataURL({
            format: 'jpeg',
            multiplier: 1 / SCALE
        })
    })

}

function getCanvasObj() {
    return JSON.stringify(canvas)
}


// ***********************************************************************
// ***********************************************************************
// *********************** Fabric Helper Functions ***********************
// ***********************************************************************
// ***********************************************************************

// Will process all text and textboxes and add them to the Canvas
function addTextToCanvas(slide_obj, _callback = addExistingTxtToCanvas) {
    canvas.remove(title_txt_box)
    canvas.remove(content_txt_box)
    canvas.remove(title_bounding_box)
    canvas.remove(content_bounding_box)

    title_txt_box = fabricMakeTitleText(slide_obj.title)
    content_txt_box = processContent(slide_obj.content)
    title_bounding_box = fabricMakeRect(
        MARGIN * SCALE, MARGIN * SCALE,
        MAX_RECT_WIDTH * SCALE, title_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE)
    content_bounding_box = fabricMakeRect(
        MARGIN * SCALE, content_txt_box.top - TXT_PADDING * SCALE,
        MAX_RECT_WIDTH * SCALE, content_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE)

    if (bkImageFabricGroup !== undefined) {
        bkImageFabricGroup._objects[1].clipPath = new fabric.Group(
            [
                // Title Box
                fabricMakeRect(
                    MARGIN * SCALE, MARGIN * SCALE,
                    MAX_RECT_WIDTH * SCALE, title_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE),
                // Content Box
                fabricMakeRect(
                    MARGIN * SCALE, content_txt_box.top - TXT_PADDING * SCALE,
                    MAX_RECT_WIDTH * SCALE, content_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE)
            ],
            {
                absolutePositioned: true
            }
        )
    }

    _callback()
}

function addExistingTxtToCanvas() {
    canvas.add(title_bounding_box);
    canvas.add(content_bounding_box);
    canvas.add(title_txt_box)
    canvas.add(content_txt_box)
}

// Returns the vertical position of the Top image
function getPosition() {
    // If it's not defined or it's at default "top" position, return null
    if (bkImageFabricGroup === undefined
        ||
        bkImageFabricGroup.top === (IMAGE_HEIGHT * SCALE - bkImageFabricGroup.getScaledHeight()) / 2) {
        return null;
    }
    return bkImageFabricGroup.top / SCALE
}

function updateBkImageGroup(slide_obj, _callback = (group) => { canvas.add(group) }) {
    const images = {}

    const lastPart = () => {
        bkImageFabricGroup = new fabric.Group(
            [
                images.non_blurred, images.blurred
            ],
            {
                ...((slide_obj.img.reverse_fit) ?
                    {
                        lockRotation: true,
                        lockMovementX: true,
                        centeredScaling: true,
                        lockSkewingX: true,
                        lockSkewingY: true
                    }
                    :
                    { selectable: false }
                ),
                objectCaching: false
            }
        )

        _callback(bkImageFabricGroup)
    }

    let async_counter = 2;

    getBkImageFabric(slide_obj, (img) => {
        images.non_blurred = img
        async_counter--;
        if (async_counter == 0) {
            lastPart()
        }
    })

    getBlurredBkImageFabric(slide_obj, (img) => {
        images.blurred = img
        async_counter--;
        if (async_counter == 0) {
            lastPart()
        }
    })
}

// Will create an image, scale it properly and pass it to the callback
function getBkImageFabric(slide_obj, _callback = (img) => { canvas.add(img) }) {
    fabric.Image.fromURL(
        slide_obj.img.src,
        (img, err) => {
            if (err) {
                throw Error(`There was an error loading the image ${slide_obj.img?.src}`)
            } else {
                if (slide_obj.img?.reverse_fit) {
                    if (img.getScaledWidth() / img.getScaledHeight() > 4.0 / 5) {
                        img.scaleToWidth(canvas.getWidth())
                    } else {
                        img.scaleToHeight(canvas.getHeight())
                    }
                } else {
                    if (img.getScaledWidth() / img.getScaledHeight() > 4.0 / 5) {
                        img.scaleToHeight(canvas.getHeight())
                    } else {
                        img.scaleToWidth(canvas.getWidth())
                    }
                }

                if (typeof slide_obj.img?.top == 'number') {
                    img.set({ 'top': slide_obj.img.top * SCALE });
                } else {
                    img.set({ 'top': (IMAGE_HEIGHT * SCALE - img.getScaledHeight()) / 2 });
                }

                _callback(img)
            }
        },
        // {
        //     lockRotation: true,
        //     lockMovementX: true,
        //     lockScalingX: true,
        //     lockScalingY: true,
        //     lockSkewingX: true,
        //     lockSkewingY: true,
        //     objectCaching: false
        // }
    )

}

// Will pass a slighly blurred image to the callback function
function getBlurredBkImageFabric(slide_obj, _callback = (img) => { canvas.add(img) }) {
    getBkImageFabric(slide_obj, (img) => {
        img.filters.push(smallBkBlur)
        img.applyFilters()

        _callback(img)
    })
}

// Will update the blBkImageFabric (THE CALLBACK ADDS TO CANVAS)
function updateBlBkImageFabric(slide_obj, _callback = img => { canvas.add(img) }) {
    fabric.Image.fromURL(
        slide_obj.img.src,
        (img, err) => {
            if (err) {
                canvas.remove(blBkImageFabric)
                blBkImageFabric = undefined;
                throw Error(`There was an error loading the image ${slide_obj.img?.src}`)
            } else {
                if (blBkImageFabric !== undefined) {
                    canvas.remove(blBkImageFabric)
                }
                blBkImageFabric = img

                if (blBkImageFabric.getScaledWidth() / blBkImageFabric.getScaledHeight() > 4.0 / 5) {
                    blBkImageFabric.scaleToHeight(canvas.getHeight())
                } else {
                    blBkImageFabric.scaleToWidth(canvas.getWidth())
                }
                blBkImageFabric.set({
                    'top': (IMAGE_HEIGHT * SCALE - blBkImageFabric.getScaledHeight()) / 2,
                    'left': (IMAGE_WIDTH * SCALE - blBkImageFabric.getScaledWidth()) / 2,
                });

                blBkImageFabric.filters.push(new fabric.Image.filters.Blur({ blur: 0.277777777777777 }))
                blBkImageFabric.applyFilters()

                _callback(blBkImageFabric)
            }
        },
        {
            selectable: false,
        })
}

// Makes the rounded-corner blue rectangle
function fabricMakeRect(x, y, width, height) {
    return new fabric.Rect({
        left: x,
        top: y,
        width: width,
        height: height,
        fill: `rgba(44, 109, 195, 0.62)`,
        rx: CORNER_RADIUS * SCALE,
        ry: CORNER_RADIUS * SCALE,
        selectable: false,
    })
}

function fabricMakeTitleText(text) {
    return new fabric.Textbox(text, {
        // Will need to adjust positions
        left: MARGIN * 1.5 * SCALE,
        top: MARGIN * 1.5 * SCALE,
        fill: 'white',
        fontFamily: "Celebes",
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontSize: 77 * SCALE,
        textAlign: 'center',
        // Color, horizontal offset, vertical offest, blur radius
        shadow: `rgba(0,0,0,0.6) ${0.92705 * SCALE}px ${2.853 * SCALE}px ${5 * SCALE}px`,
        width: (MAX_RECT_WIDTH - MARGIN) * SCALE,
        lineHeight: 0.9,
        selectable: false
    })
}

function fabricMakeContentText(text = '') {
    text = text.replace(/\n*$/, '')

    const txt_box = new fabric.Textbox(text, {
        left: MARGIN * 1.5 * SCALE,
        fill: 'white',
        fontFamily: "Celebes",
        textAlign: 'left',
        // Color, horizontal offset, vertical offest, blur radius
        shadow: `rgba(0,0,0,0.6) ${0.92705 * SCALE}px ${2.853 * SCALE}px ${5 * SCALE}px`,
        width: (MAX_RECT_WIDTH - MARGIN) * SCALE,
        fontSize: 50 * SCALE,
        lineHeight: 1,
        selectable: false
    })

    txt_box.top = (IMAGE_HEIGHT - MARGIN * 1.5) * SCALE - txt_box.calcTextHeight();
    return txt_box
}


// ***********************************************************************
// ***********************************************************************
// ********************** Text Processing Functions **********************
// ***********************************************************************
// ***********************************************************************

function processContent(content_obj) {
    let text = ""
    const bold_ranges = new Array()
    const italic_ranges = new Array()
    const superscript_ranges = new Array()
    const subscript_ranges = new Array()

    let prev_bullet_idx = 0;
    let working_idx = 0;
    for (let i = 0; i < content_obj.ops.length; i++) {
        let temp_txt;
        let new_bullet_idx = checkIfIsBullet(content_obj.ops, i)

        if (new_bullet_idx !== false && new_bullet_idx > prev_bullet_idx) {
            prev_bullet_idx = new_bullet_idx
            temp_txt = "• " + content_obj.ops[i].insert
        } else {
            temp_txt = content_obj.ops[i].insert
        }

        if (content_obj.ops[i].attributes !== undefined) {
            if (content_obj.ops[i].attributes.bold) {
                bold_ranges.push([working_idx, working_idx + temp_txt.length])
            }
            if (content_obj.ops[i].attributes.italic) {
                italic_ranges.push([working_idx, working_idx + temp_txt.length])
            }
            if (content_obj.ops[i].attributes.script !== undefined) {
                if (content_obj.ops[i].attributes.script === "super") {
                    superscript_ranges.push([working_idx, working_idx + temp_txt.length])
                } else if (content_obj.ops[i].attributes.script === "sub") {
                    subscript_ranges.push([working_idx, working_idx + temp_txt.length])
                }
            }
        }

        text += temp_txt
        working_idx += temp_txt.length
    }

    // Remove all the trailing '\n'
    text = text.replace(/\n*$/, '')
    const fabric_text = fabricMakeContentText(text)

    for (var i = 0; i < bold_ranges.length; i++) {
        fabric_text.setSelectionStyles({
            fontWeight: 'bold'
        }, bold_ranges[i][0], Math.min(bold_ranges[i][1]), text.length - 1)
    }
    for (var i = 0; i < italic_ranges.length; i++) {
        fabric_text.setSelectionStyles({
            fontStyle: 'italic'
        }, italic_ranges[i][0], Math.min(italic_ranges[i][1]), text.length - 1)
    }
    for (var i = 0; i < superscript_ranges.length; i++) {
        fabric_text.setSuperscript(superscript_ranges[i][0], Math.min(superscript_ranges[i][1]), text.length - 1)
    }
    for (var i = 0; i < subscript_ranges.length; i++) {
        fabric_text.setSubscript(subscript_ranges[i][0], Math.min(subscript_ranges[i][1]), text.length - 1)
    }

    return fabric_text;
}

// Looks for the first item to be '\n' returns its index if it's a bullet, false otherwise
function checkIfIsBullet(list, start_idx) {
    for (let i = start_idx; i < list.length; i++) {
        if (list[i].insert === "\n") {
            if (list[i].attributes !== undefined && list[i].attributes.list == 'bullet') {
                return i
            }
            else {
                return false
            }
        }
    }
}


module.exports = {
    updateImagePreview,
    exportSlideToFile,
    getPosition,
    getCanvasObj,
    loadFromJSON
}