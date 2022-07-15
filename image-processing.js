// Requires Fabric.js to be defined

const canvas = new fabric.Canvas('output-img', {
    preserveObjectStacking: true,
    backgroundColor: 'white',
    uniformScaling: true,
});
const smallBkBlur = new fabric.Image.filters.Blur({ blur: 0.2, clipName: 'blur' });

canvas.SCALE = canvas.getHeight() / 1350;
const CORNER_RADIUS = 43.2;
const MARGIN = 47;
const TXT_PADDING = MARGIN / 2;
const IMAGE_HEIGHT = 1350;
const IMAGE_WIDTH = 1080;
const MAX_RECT_WIDTH = IMAGE_WIDTH - MARGIN * 2

fabric.Image.fromURL(
    './SolveIt Logo.png',
    img => {
        img.scaleToHeight(31 * canvas.SCALE)
        canvas.logo = img
    }, {
    selectable: false,
    top: canvas.getHeight() - 31 * 1.5 * canvas.SCALE,
    left: canvas.getWidth() - 31 * 1.5 * canvas.SCALE,
})

// FabricJs Object of the current image
canvas.bkImageFabricGroup;
// FabricJs Object of the current blurred background
canvas.blBkImageFabric;
// The FabricJS Object Containing the Title
canvas.title_txt_box;
// The FabricJS Object Containing the Contents of the slide
canvas.content_txt_box;
// The FabricJS Object Containing the Contents' Boxes
canvas.title_bounding_box
canvas.content_bounding_box;

// This will update the image preview (no blur behind text)
function updateImagePreview(slide_obj, cite_key_value = {}) {
    if (canvas?.prev_obj === undefined) {
        return createImage(canvas, slide_obj, cite_key_value)
    } else if (canvas?.prev_obj !== slide_obj) {
        return new Promise((resolve, reject) => {
            try {
                // Update only when necessary
                const updateCanvas = (_canvas, slide_obj) => {
                    _canvas.clear()
                    _canvas.setBackgroundColor('white')

                    if (_canvas.blBkImageFabric !== undefined &&
                        (slide_obj.img.hide_blr_bk === undefined || slide_obj.img.hide_blr_bk === false) &&
                        slide_obj.img.reverse_fit !== false) {
                        _canvas.add(_canvas.blBkImageFabric)
                    }

                    if (_canvas.bkImageFabricGroup !== undefined) {
                        _canvas.add(_canvas.bkImageFabricGroup)
                    }
                    addTextToCanvas(_canvas, slide_obj, cite_key_value)

                    if (_canvas.logo) {
                        _canvas.add(_canvas.logo)
                        canvas.prevObj = structuredClone(slide_obj)
                        resolve(_canvas)
                    } else {
                        addNewLogoToCanvas(_canvas).then(() => {
                            canvas.prevObj = structuredClone(slide_obj)
                            res(_canvas)
                        })
                    }
                };

                if (slide_obj.img.src === '') {
                    canvas.bkImageFabricGroup = undefined
                    canvas.blBkImageFabric = undefined
                    updateCanvas()
                } else if (canvas.prevObj?.img?.src !== slide_obj.img.src) {
                    Promise.all([
                        // Will need to update both images
                        updateBkImageGroup(_canvas, slide_obj),
                        updateBlBkImageFabric(_canvas, slide_obj)
                    ]).then(updateCanvas).catch(err => { reject(err) })

                } else if (canvas.prevObj?.img?.reverse_fit !== slide_obj.img.reverse_fit) {
                    canvas.bkImageFabricGroup.setOptions(...getGroupOptions(slide_obj))
                    scaleForegroundImg(canvas, canvas.bkImageFabricGroup, slide_obj)
                } else {
                    updateCanvas()
                }
            } catch (error) {
                reject(error)
            }
        })
    }
}

function createImage(_canvas, slide_obj, cite_key_value = {}) {
    return new Promise((resolve, reject) => {
        try {
            // This will be done last, it is where the promise will be resolved
            const updateCanvas = () => {
                _canvas.clear()
                _canvas.setBackgroundColor('white')

                if (_canvas.blBkImageFabric !== undefined &&
                    (slide_obj.img.hide_blr_bk === undefined || slide_obj.img.hide_blr_bk === false) &&
                    slide_obj.img.reverse_fit !== false) {
                    _canvas.add(_canvas.blBkImageFabric)
                }

                if (_canvas.bkImageFabricGroup !== undefined) {
                    _canvas.add(_canvas.bkImageFabricGroup)
                }
                addTextToCanvas(_canvas, slide_obj, cite_key_value)

                if (_canvas.logo) {
                    _canvas.add(_canvas.logo)
                    resolve(_canvas)
                } else {
                    addNewLogoToCanvas(_canvas).then(() => { resolve(_canvas) })
                }
            };

            if (slide_obj.img.src === '') {
                _canvas.bkImageFabricGroup = undefined
                _canvas.blBkImageFabric = undefined
                updateCanvas()
            } else {
                Promise.all([
                    // Will need to update both images
                    updateBkImageGroup(_canvas, slide_obj),
                    updateBlBkImageFabric(_canvas, slide_obj)
                ]).then(updateCanvas).catch(err => { reject(err) })
            }
        } catch (error) {
            reject(error)
        }
    })

}

function exportSlideToJpegData(slide_obj, cite_key_value = {}) {
    var _canvas = createGhostCanvas()
    return createImage(_canvas, slide_obj, cite_key_value).then(result => {
        return _canvas.toDataURL({
            format: 'jpeg',
            multiplier: 1 / _canvas.SCALE
        }).substring(23);
    }).catch(err => { return err; })
}


// ***********************************************************************
// ***********************************************************************
// *********************** Fabric Helper Functions ***********************
// ***********************************************************************
// ***********************************************************************


function createGhostCanvas() {
    const html_el = document.createElement('canvas')
    html_el.width = IMAGE_WIDTH
    html_el.height = IMAGE_HEIGHT
    const _canvas = new fabric.Canvas(html_el, {
        preserveObjectStacking: true,
        backgroundColor: 'white',
        uniformScaling: true,
    })
    _canvas.SCALE = 1

    // FabricJs Object of the current image
    _canvas.bkImageFabricGroup;
    // FabricJs Object of the current blurred background
    _canvas.blBkImageFabric;
    // The FabricJS Object Containing the Title
    _canvas.title_txt_box;
    // The FabricJS Object Containing the Contents of the slide
    _canvas.content_txt_box;
    // The FabricJS Object Containing the Contents' Boxes
    _canvas.title_bounding_box
    _canvas.content_bounding_box;

    return _canvas;
}

function addNewLogoToCanvas(_canvas) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(
            './SolveIt Logo.png',
            img => {
                img.scaleToHeight(31 * _canvas.SCALE)
                _canvas.logo = img

                _canvas.add(img)

                resolve(img)
            }, {
            selectable: false,
            top: _canvas.getHeight() - 31 * 1.5 * _canvas.SCALE,
            left: _canvas.getWidth() - 31 * 1.5 * _canvas.SCALE,
        })
    })
}

// Will process all text and textboxes and add them to the Canvas
function addTextToCanvas(_canvas = canvas, slide_obj, cite_key_value = {}) {

    if (_canvas.title_bounding_box !== null && _canvas.title_bounding_box !== undefined) {
        _canvas.remove(_canvas.title_bounding_box);
    }
    if (_canvas.content_bounding_box !== null && _canvas.content_bounding_box !== undefined) {
        _canvas.remove(_canvas.content_bounding_box);
    }
    if (_canvas.title_txt_box !== null && _canvas.title_txt_box !== undefined) {
        _canvas.remove(_canvas.title_txt_box)
    }
    if (_canvas.content_txt_box !== null && _canvas.content_txt_box !== undefined) {
        _canvas.remove(_canvas.content_txt_box)
    }

    _canvas.title_txt_box = fabricMakeTitleText(_canvas, slide_obj.title)
    _canvas.content_txt_box = processContent(_canvas, slide_obj.content, cite_key_value)
    if (_canvas.title_txt_box === null) {
        _canvas.title_bounding_box = null
    } else {
        _canvas.title_bounding_box = fabricMakeRect(_canvas,
            MARGIN * _canvas.SCALE, MARGIN * _canvas.SCALE,
            MAX_RECT_WIDTH * _canvas.SCALE, _canvas.title_txt_box.calcTextHeight() + TXT_PADDING * 2 * _canvas.SCALE)
    }
    if (_canvas.content_txt_box === null) {
        _canvas.content_bounding_box = null
    } else {
        _canvas.content_bounding_box = fabricMakeRect(_canvas,
            MARGIN * _canvas.SCALE, _canvas.content_txt_box.top - TXT_PADDING * _canvas.SCALE,
            MAX_RECT_WIDTH * _canvas.SCALE, _canvas.content_txt_box.calcTextHeight() + TXT_PADDING * 2 * _canvas.SCALE)
    }

    if (_canvas.bkImageFabricGroup !== undefined && (_canvas.title_txt_box !== null || _canvas.content_txt_box !== null)) {
        _canvas.bkImageFabricGroup._objects[1].clipPath = new fabric.Group(
            [
                // Title Box
                ...((_canvas.title_txt_box === null) ? [] : [fabricMakeRect(_canvas,
                    MARGIN * _canvas.SCALE, MARGIN * _canvas.SCALE,
                    MAX_RECT_WIDTH * _canvas.SCALE, _canvas.title_txt_box.calcTextHeight() + TXT_PADDING * 2 * _canvas.SCALE, "#fff")]),
                // Content Box
                ...((_canvas.content_txt_box === null) ? [] : [fabricMakeRect(_canvas,
                    MARGIN * _canvas.SCALE, _canvas.content_txt_box.top - TXT_PADDING * _canvas.SCALE,
                    MAX_RECT_WIDTH * _canvas.SCALE, _canvas.content_txt_box.calcTextHeight() + TXT_PADDING * 2 * _canvas.SCALE, "#fff")])
            ],
            {
                absolutePositioned: true
            }
        )
    }

    if (_canvas.title_bounding_box !== null && _canvas.title_bounding_box !== undefined) {
        _canvas.add(_canvas.title_bounding_box);
    }
    if (_canvas.content_bounding_box !== null && _canvas.content_bounding_box !== undefined) {
        _canvas.add(_canvas.content_bounding_box);
    }
    if (_canvas.title_txt_box !== null && _canvas.title_txt_box !== undefined) {
        _canvas.add(_canvas.title_txt_box)
    }
    if (_canvas.content_txt_box !== null && _canvas.content_txt_box !== undefined) {
        _canvas.add(_canvas.content_txt_box)
    }
}

// Returns the vertical position of the Top image
function getPosition(_canvas = canvas) {
    // If it's not defined or it's at default "top" position, return null
    if (_canvas.bkImageFabricGroup === undefined
        ||
        _canvas.bkImageFabricGroup.top === (IMAGE_HEIGHT * _canvas.SCALE - _canvas.bkImageFabricGroup.getScaledHeight()) / 2) {
        return null;
    }
    return _canvas.bkImageFabricGroup.top / _canvas.SCALE
}

function getWidth(_canvas = canvas) {
    // If it's not defined or it's greater than the canvas-width, return null
    if (_canvas.bkImageFabricGroup === undefined
        ||
        Math.round(_canvas.bkImageFabricGroup.getScaledWidth()) === Math.round(_canvas.getWidth())) {
        return null;
    }
    return _canvas.bkImageFabricGroup.getScaledWidth() / _canvas.SCALE
}

function updateBkImageGroup(_canvas, slide_obj) {
    return new Promise((resolve, reject) => {
        Promise.all([getBkImageFabric(_canvas, slide_obj), getBlurredBkImageFabric(_canvas, slide_obj)]).then(images => {
            _canvas.bkImageFabricGroup = new fabric.Group(
                images,
                {
                    ...getGroupOptions(slide_obj),
                    objectCaching: false
                }
            )

            _canvas.bkImageFabricGroup.setControlsVisibility({
                mb: false,
                ml: false,
                mr: false,
                mt: false,
                mtr: false,
            })

            resolve(_canvas.bkImageFabricGroup)
        }).catch(reject)
    })
}

// Will resolve with a new, properly scaled image
function getBkImageFabric(_canvas, slide_obj) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(
            slide_obj.img.src,
            (img, err) => {
                if (err) {
                    reject(`There was an error loading the image ${slide_obj.img?.src}`)
                } else {
                    scaleForegroundImg(_canvas, img, slide_obj)

                    resolve(img)
                }
            },
            {
                crossOrigin: 'anonymous'
            }
        )
    })
}

// Will resolve with a slighly blurred image
function getBlurredBkImageFabric(_canvas, slide_obj) {
    return getBkImageFabric(_canvas, slide_obj).then((img) => {
        img.filters.push(smallBkBlur)
        img.applyFilters()

        return img
    })
}

// Scales the img to fit the _canvas in accordance with slide_obj's properties
function scaleForegroundImg(_canvas, img, slide_obj) {
    if (slide_obj.img?.reverse_fit === true &&
        slide_obj.img?.width !== null && slide_obj.img?.width !== undefined) {
        img.scaleToWidth(slide_obj.img.width * _canvas.SCALE)
    } else if (slide_obj.img?.reverse_fit === true) {
        if (img.getScaledWidth() / img.getScaledHeight() > 4.0 / 5) {
            img.scaleToWidth(_canvas.getWidth())
        } else {
            img.scaleToHeight(_canvas.getHeight())
        }
    } else {
        if (img.getScaledWidth() / img.getScaledHeight() > 4.0 / 5) {
            img.scaleToHeight(_canvas.getHeight())
        } else {
            img.scaleToWidth(_canvas.getWidth())
        }
    }

    if (slide_obj.img.top !== null && slide_obj.img.reverse_fit) {
        img.set({ 'top': slide_obj.img.top * _canvas.SCALE, 'left': (_canvas.getWidth() - img.getScaledWidth()) / 2 });
    } else {
        img.set({ 'top': (IMAGE_HEIGHT * _canvas.SCALE - img.getScaledHeight()) / 2, 'left': (_canvas.getWidth() - img.getScaledWidth()) / 2 });
    }
}

// Returns the appropiat image-group options in accordance with the current slide_obj properties
function getGroupOptions(slide_obj) {
    if (slide_obj.img.reverse_fit) {
        return {
            lockScalingFlip: true,
            lockRotation: true,
            lockMovementX: true,
            centeredScaling: true,
            lockSkewingX: true,
            lockSkewingY: true,
        }
    } else {
        return { selectable: false }
    }
}

// Will update the _canvas.blBkImageFabric and resolve with _canvas.blBkImageFabric
function updateBlBkImageFabric(_canvas, slide_obj) {
    return new Promise((resolve, reject) => {
        fabric.Image.fromURL(
            slide_obj.img.src,
            (img, err) => {
                if (err) {
                    reject(err)
                }
                if (_canvas.blBkImageFabric !== undefined) {
                    _canvas.remove(_canvas.blBkImageFabric)
                }
                _canvas.blBkImageFabric = img

                if (_canvas.blBkImageFabric.getScaledWidth() / _canvas.blBkImageFabric.getScaledHeight() > 4.0 / 5) {
                    _canvas.blBkImageFabric.scaleToHeight(_canvas.getHeight())
                } else {
                    _canvas.blBkImageFabric.scaleToWidth(_canvas.getWidth())
                }
                _canvas.blBkImageFabric.set({
                    'top': (IMAGE_HEIGHT * _canvas.SCALE - _canvas.blBkImageFabric.getScaledHeight()) / 2,
                    'left': (IMAGE_WIDTH * _canvas.SCALE - _canvas.blBkImageFabric.getScaledWidth()) / 2,
                });

                _canvas.blBkImageFabric.filters.push(new fabric.Image.filters.Blur({ blur: 0.277777777777777 }))
                _canvas.blBkImageFabric.applyFilters()

                resolve(_canvas.blBkImageFabric)
            },
            {
                selectable: false,
                crossOrigin: 'anonymous'
            }
        )
    })
}

// Makes the rounded-corner blue rectangle
function fabricMakeRect(_canvas, x, y, width, height, _fill_color = `rgba(44, 109, 195, 0.62)`) {
    return new fabric.Rect({
        left: x,
        top: y,
        width: width,
        height: height,
        fill: _fill_color,
        rx: CORNER_RADIUS * _canvas.SCALE,
        ry: CORNER_RADIUS * _canvas.SCALE,
        selectable: false,
    })
}

function fabricMakeTitleText(_canvas, text) {
    if (text === undefined || text === null || text === '') {
        return null
    }
    return new fabric.Textbox(text, {
        // Will need to adjust positions
        left: MARGIN * 1.5 * _canvas.SCALE,
        top: MARGIN * 1.5 * _canvas.SCALE,
        fill: 'white',
        fontFamily: "Celebes",
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontSize: 77 * _canvas.SCALE,
        textAlign: 'center',
        // Color, horizontal offset, vertical offest, blur radius
        shadow: `rgba(0,0,0,0.6) ${0.92705 * _canvas.SCALE}px ${2.853 * _canvas.SCALE}px ${5 * _canvas.SCALE}px`,
        width: (MAX_RECT_WIDTH - MARGIN) * _canvas.SCALE,
        lineHeight: 0.9,
        selectable: false
    })
}

// ***********************************************************************
// ***********************************************************************
// ********************** Text Processing Functions **********************
// ***********************************************************************
// ***********************************************************************

function processContent(_canvas, content_obj, cite_key_value = {}) {
    let text = ""
    const bold_ranges = new Array()
    const italic_ranges = new Array()
    const superscript_ranges = new Array()
    const subscript_ranges = new Array()

    let working_idx = 0;
    for (let i = 0; i < content_obj?.ops?.length; i++) {
        let temp_txt;
        let new_bullet_idx = checkIfIsBullet(content_obj.ops, i)

        if (new_bullet_idx !== false && new_bullet_idx > prev_bullet_idx) {
            prev_bullet_idx = new_bullet_idx

            // Make sure that to add the bullet to the last line of the text item
            const lines = content_obj.ops[i].insert.split('\n')
            lines[lines.length - 1] = "• " + lines[lines.length - 1]

            temp_txt = lines.join('\n')
        } else if (content_obj.ops[i].insert?.citation !== undefined) {
            const key = content_obj.ops[i].insert.citation.key
            temp_txt = (cite_key_value[key] !== undefined) ? `${cite_key_value[key]}` : `@${key}`

            if (content_obj.ops[i]?.attributes?.script !== "super") {
                superscript_ranges.push([working_idx, working_idx + temp_txt.length])
            }
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
            if (content_obj.ops[i].attributes.list == 'bullet') {
                // Add the bullet
                const lines = text.split('\n')
                const moving_from = working_idx - lines[lines.length - 1].length
                
                lines[lines.length - 1] = "• " + lines[lines.length - 1]
                text = lines.join('\n')
                
                // Update the shifted ranges shifted by adding "• "
                for (const format_range_list of [bold_ranges, italic_ranges, superscript_ranges, subscript_ranges]) {
                    for (const range of format_range_list) {
                        if (range[0] >= moving_from) {
                            range[0] += 2
                            range[1] += 2
                        }
                    }
                }
                working_idx += 2
            }
        }

        text += temp_txt
        working_idx += temp_txt.length
    }


    // Remove all the trailing '\n'
    text = text.replace(/\n*$/, '')

    if (text === '') {
        return null
    }

    const fabric_text = new fabric.Textbox(text, {
        left: MARGIN * 1.5 * _canvas.SCALE,
        fill: 'white',
        fontFamily: "Celebes",
        textAlign: 'left',
        // Color, horizontal offset, vertical offest, blur radius
        shadow: `rgba(0,0,0,0.6) ${0.92705 * _canvas.SCALE}px ${2.853 * _canvas.SCALE}px ${5 * _canvas.SCALE}px`,
        width: (MAX_RECT_WIDTH - MARGIN) * _canvas.SCALE,
        fontSize: 50 * _canvas.SCALE,
        lineHeight: 1,
        selectable: false
    })

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

    fabric_text.top = (IMAGE_HEIGHT - MARGIN * 1.5) * _canvas.SCALE - fabric_text.calcTextHeight();

    return fabric_text;
}

export {
    updateImagePreview,
    getPosition,
    getWidth,
    exportSlideToJpegData
}