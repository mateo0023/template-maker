
const sharp = require('sharp')
const path = require('path');
const fabric = require("fabric").fabric

// fabric.Object.prototype.objectCaching = false;

sharp.cache(false)

const canvas = new fabric.Canvas('output-img', {
    preserveObjectStacking: true
});
const smallBkBlur = new fabric.Image.filters.Blur({ blur: 0.1, clipName: 'blur' });

const SCALE = canvas.getHeight() / 1350;
const CORNER_RADIUS = 43.2;
const MARGIN = 47;
const TXT_PADDING = MARGIN / 2;
const IMAGE_HEIGHT = 1350;
const IMAGE_WIDTH = 1080;
const MAX_RECT_WIDTH = IMAGE_WIDTH - MARGIN * 2

// FabricJs Object of the current image
var bkImageFabricGroup;
// FabricJs Object of the current image
var bkImageFabric;
// FabricJs Object of the current image
var bkImageBlurFabric;
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

// This ONLY uses Sharp
async function updateSampleImage(slide_obj, base_img_buff, quill_obj) {
    const added_txt_padding = CORNER_RADIUS * 2
    const img_out = document.getElementById("sample-output-img")

    // Process the new image if complete
    if (!(slide_obj.title === '' && slide_obj.content === '')) {
        // let content_height = 0
        // const quill_contents = document.getElementById('slide_content').children[0].children
        // for (let i = 0; i < quill_contents.length && quill_obj.getLength() > 1; i++) {
        //     content_height += quill_contents[i].clientHeight
        // }
        // Multiplication is to convert from HTML px to real pixels
        let content_height = (quill_obj.getLength() > 1) ? quill_obj.getBounds(0, quill_obj.getLength()).height * 2.371900826446281 : 0;
        // content_height *= 2.371900826446281;

        sharp(base_img_buff).composite([
            // Create content box only if there's content
            ...((content_height > 0) ?

                [{
                    input: await sharp({
                        create: {
                            width: MAX_RECT_WIDTH,
                            height: Math.round(content_height + added_txt_padding),
                            channels: 4,
                            background: { r: 44, g: 109, b: 195, alpha: 0.62 }
                        }
                    }).png().toBuffer(),
                    top: Math.round(IMAGE_HEIGHT - content_height - added_txt_padding - MARGIN),
                    left: MARGIN
                }] : []
            ),
            // Create title box only if there's a title
            ...((slide_obj.title.length > 0) ?
                [{
                    input: await sharp({
                        create: {
                            width: MAX_RECT_WIDTH,
                            // Roughly 27 chars per line, 60 pixels per line
                            height: Math.round(Math.ceil(slide_obj.title.length / 27) * 60 + added_txt_padding),
                            channels: 4,
                            background: { r: 44, g: 109, b: 195, alpha: 0.62 }
                        }
                    }).png().toBuffer(),
                    top: MARGIN,
                    left: MARGIN
                }] : [])
        ])
            .jpeg().toBuffer((e, buff, info) => {
                if (e) {
                    console.log(e)
                    img_out.src = ''
                } else {
                    img_out.src = 'data:image/jpeg;base64,' + buff.toString('base64');
                }
            })
    } else {
        img_out.src = 'data:image/jpeg;base64,' + base_img_buff.toBuffer().toString('base64');
    }
}

// This should use the Canvas API to add the text to the pre_processed buffer
function makeFullImage(buffer, slide_obj) {
}

// This will update the image preview (no blur behind text)
function updateImagePreview(new_slide_obj, working_path) {
    const full_image_path = path.join(working_path, new_slide_obj.img.src)

    return new Promise((res, rej) => {
        // This will be done last, it is where the promise will be resolved
        const updateCanvas = () => {
            canvas.clear()
            if (new_slide_obj.img.hide_blr_bk === undefined || new_slide_obj.img.hide_blr_bk === false) {
                canvas.add(blBkImageFabric)
            }

            bkImageFabricGroup = new fabric.Group([
                bkImageFabric, bkImageBlurFabric
            ],
                {
                    lockRotation: true,
                    lockMovementX: true,
                    // lockScalingX: true,
                    // lockScalingY: true,
                    centeredScaling: true,
                    lockSkewingX: true,
                    lockSkewingY: true,
                    objectCaching: false
                })
            canvas.add(bkImageFabricGroup)
            addTextToCanvas(new_slide_obj)
            
            res(true)
        };

        if (prevObj?.img?.src !== new_slide_obj.img.src) {
            let async_counter = 3;

            // Will need to update both images
            updateBkImageFabric(new_slide_obj, full_image_path, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })
            updateBkImageBlurFabric(new_slide_obj, full_image_path, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })

            updateBlBkImageFabric(new_slide_obj, full_image_path, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })
        } else if (prevObj?.img?.reverse_fit !== new_slide_obj.img.reverse_fit) {
            let async_counter = 2;
            updateBkImageFabric(new_slide_obj, full_image_path, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })
            updateBkImageBlurFabric(new_slide_obj, full_image_path, () => {
                async_counter--;
                if (async_counter == 0) {
                    updateCanvas()
                }
            })
        } else {
            updateCanvas()
        }

        prevObj = structuredClone(new_slide_obj)
    })

}

function exportSlideToFile(slide_obj, working_path) {
    updateImagePreview(slide_obj, working_path).then(result => {
        canvas.toDataURL({
            format: 'jpeg',
            multiplier: 1/SCALE
        })
    })

}

function getTxtSvg(slide_obj) {
    canvas.clear()

    // canvas.setBackgroundColor()
    addTextToCanvas(slide_obj)
}

// Sets the curr_pre_processed_image to the most current values of slide
// Will call the _callback function with the updated base_lyr
async function makeBaseImage(slide, working_path, _callback = () => { }) {
    if (slide.img.src === '' || slide.img.src === undefined) {
        // Make the callback to the object
        _callback(
            await sharp({
                create: {
                    width: IMAGE_WIDTH,
                    height: IMAGE_HEIGHT,
                    channels: 3,
                    background: { r: 29, g: 219, b: 121, }
                }
            }).jpeg().toBuffer()
        )
    } else {
        const full_image_path = path.join(working_path, slide.img.src)

        const foreground_img = await getSharpImage(full_image_path, slide.img.reverse_fit)

        let base_lyr = sharp({
            create: {
                width: IMAGE_WIDTH,
                height: IMAGE_HEIGHT,
                channels: 3,
                background: { r: 0, g: 0, b: 0 }
            }
        }).composite([
            // Add the blurred background only if necessary
            ...((slide.img.reverse_fit) ?
                [{
                    input: await getSharpBlurredBuffer(full_image_path),
                    top: 0,
                    left: 0
                }]
                : []),
            // Background Image
            {
                input: await foreground_img.toBuffer(),
                top: (slide.img.reverse_fit) ? Math.round((IMAGE_HEIGHT - (await foreground_img.metadata()).height) / 2) : 0,
                left: 0
            }])

        if (path.extname(slide.img.src) === '.png') {
            base_lyr = await base_lyr.png()
        } else if (path.extname(slide.img.src) === '.jpeg' || path.extname(slide.img.src) === '.jpg') {
            base_lyr = await base_lyr.jpeg()
        }

        _callback(await base_lyr.toBuffer())
    }
}

// **********************************************************************
// **********************************************************************
// *********************** Sharp Helper Functions ***********************
// **********************************************************************
// **********************************************************************

function getSharpBlurredBuffer(image_path) {
    return sharp(image_path).resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: "cover" }).blur(20).toBuffer()
}

function getSharpImage(image_path, reverse_fit = false) {
    return sharp(image_path)
        .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: (reverse_fit) ? "inside" : "cover" })
}

function getSharpImageBkBuffer(image_path, reverse_fit = false) {
    return sharp(image_path)
        .resize(IMAGE_WIDTH, IMAGE_HEIGHT, { fit: (reverse_fit) ? "inside" : "cover" }).blur(5).toBuffer()
}

function maskBkWithSvg(svg) {

}

function getSharpImageBuffer(image_path, reverse_fit = false) {
    return getSharpImage(image_path, reverse_fit).toBuffer()
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
    title_bounding_box = fabricMakeRect(MARGIN * SCALE, MARGIN * SCALE, MAX_RECT_WIDTH * SCALE, title_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE)
    content_bounding_box = fabricMakeRect(MARGIN * SCALE, content_txt_box.top - TXT_PADDING * SCALE, MAX_RECT_WIDTH * SCALE, content_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE)

    if (bkImageBlurFabric !== undefined) {
        bkImageBlurFabric.clipPath = new fabric.Group(
            [
                // Title Box
                fabricMakeRect(MARGIN * SCALE, MARGIN * SCALE, MAX_RECT_WIDTH * SCALE, title_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE),
                // Content Box
                fabricMakeRect(MARGIN * SCALE, content_txt_box.top - TXT_PADDING * SCALE, MAX_RECT_WIDTH * SCALE, content_txt_box.calcTextHeight() + TXT_PADDING * 2 * SCALE)
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

// Will update the bkImageFabric (THE CALLBACK ADDS TO CANVAS)
function updateBkImageFabric(slide_obj, img_path, _callback = (img) => { canvas.add(img) }) {
    fabric.Image.fromURL(
        img_path,
        (img, err) => {
            if (err) {
                canvas.remove(bkImageFabric)
                bkImageFabric = undefined;
                throw Error(`There was an error loading the image ${slide_obj.img?.src}`)
            } else {
                if (bkImageFabric !== undefined) {
                    canvas.remove(bkImageFabric)
                }

                bkImageFabric = img

                if (slide_obj.img?.reverse_fit) {
                    if (bkImageFabric.getScaledWidth() / bkImageFabric.getScaledHeight() > 4.0 / 5) {
                        bkImageFabric.scaleToWidth(canvas.getWidth())
                    } else {
                        bkImageFabric.scaleToHeight(canvas.getHeight())
                    }


                    bkImageFabric.set({ 'top': (IMAGE_HEIGHT * SCALE - bkImageFabric.getScaledHeight()) / 2 });
                }

                _callback(bkImageFabric)
            }
        },
        {
            lockRotation: true,
            lockMovementX: true,
            lockScalingX: true,
            lockScalingY: true,
            lockSkewingX: true,
            lockSkewingY: true,
        })

}

// Will update the bkImageFabric (THE CALLBACK ADDS TO CANVAS)
function updateBkImageBlurFabric(slide_obj, img_path, _callback = (img) => { canvas.add(img) }) {
    fabric.Image.fromURL(
        img_path,
        (img, err) => {
            if (err) {
                canvas.remove(bkImageBlurFabric)
                bkImageBlurFabric = undefined;
                throw Error(`There was an error loading the image ${slide_obj.img?.src}`)
            } else {
                if (bkImageBlurFabric !== undefined) {
                    canvas.remove(bkImageBlurFabric)
                }

                bkImageBlurFabric = img

                if (slide_obj.img?.reverse_fit) {
                    if (bkImageBlurFabric.getScaledWidth() / bkImageBlurFabric.getScaledHeight() > 4.0 / 5) {
                        bkImageBlurFabric.scaleToWidth(canvas.getWidth())
                    } else {
                        bkImageBlurFabric.scaleToHeight(canvas.getHeight())
                    }


                    bkImageBlurFabric.set({ 'top': (IMAGE_HEIGHT * SCALE - bkImageBlurFabric.getScaledHeight()) / 2 });
                }

                bkImageBlurFabric.filters.push(smallBkBlur)
                bkImageBlurFabric.applyFilters()

                _callback(bkImageBlurFabric)
            }
        },
        {
            lockRotation: true,
            lockMovementX: true,
            lockScalingX: true,
            lockScalingY: true,
            lockSkewingX: true,
            lockSkewingY: true,
        })

}

// Will update the blBkImageFabric (THE CALLBACK ADDS TO CANVAS)
function updateBlBkImageFabric(slide_obj, img_path, _callback = img => { canvas.add(img) }) {
    fabric.Image.fromURL(
        img_path,
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
    updateSampleImage,
    makeBaseImage,
    makeFullImage,
    updateImagePreview,
    exportSlideToFile
}