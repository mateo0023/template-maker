
const sharp = require('sharp')
const path = require('path');
const fabric = require("fabric").fabric

sharp.cache(false)

const CORNER_RADIUS = 43.2;

async function updateSampleImage(slide_obj, base_img_buff, quill_obj) {
    const added_txt_padding = 43.2 * 2
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
                            width: 993,
                            height: Math.round(content_height + added_txt_padding),
                            channels: 4,
                            background: { r: 44, g: 109, b: 195, alpha: 0.62 }
                        }
                    }).png().toBuffer(),
                    top: Math.round(1350 - content_height - added_txt_padding - 47),
                    left: 47
                }] : []
            ),
            // Create title box only if there's a title
            ...((slide_obj.title.length > 0) ?
                [{
                    input: await sharp({
                        create: {
                            width: 993,
                            // Roughly 27 chars per line, 60 pixels per line
                            height: Math.round(Math.ceil(slide_obj.title.length / 27) * 60 + added_txt_padding),
                            channels: 4,
                            background: { r: 44, g: 109, b: 195, alpha: 0.62 }
                        }
                    }).png().toBuffer(),
                    top: 47,
                    left: 47
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
    const canvas = new fabric.Canvas('output-img');
    const added_txt_padding = 47 / 2

    // Multiplication is to convert from HTML px to real pixels
    // let content_height = (quill_obj.getLength() > 1) ? quill_obj.getBounds(0, quill_obj.getLength()).height * 2.371900826446281 : 0;

    fabric.Image.fromURL('data:image/jpeg;base64,' + buffer.toString('base64'), (img) => {
        const title_txt_box = fabricMakeTitleText(slide_obj.title)
        const content_txt_box = processContent(slide_obj.content)
        canvas.add(img)
        canvas.add(fabricMakeRect(47, 47, 993, title_txt_box.calcTextHeight() + added_txt_padding * 2));
        canvas.add(fabricMakeRect(47, content_txt_box.top - added_txt_padding, 993, content_txt_box.calcTextHeight() + added_txt_padding * 2));
        canvas.add(title_txt_box)
        canvas.add(content_txt_box)

        // canvas.requestRenderAll()
    })
}

// Sets the curr_pre_processed_image to the most current values of slide
// Will call the _callback function with the updated base_lyr
async function makeBaseImage(slide, working_path, _callback = () => { }) {
    if (slide.img.src === '' || slide.img.src === undefined) {
        // Make the callback to the object
        _callback(
            await sharp({
                create: {
                    width: 1080,
                    height: 1350,
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
                width: 1080,
                height: 1350,
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
                top: (slide.img.reverse_fit) ? Math.round((1350 - (await foreground_img.metadata()).height) / 2) : 0,
                left: 0
            }])

        if (path.extname(slide.img.src) === '.png') {
            base_lyr = await base_lyr.png()
        } else if (path.extname(slide.img.src) === '.jpeg' || path.extname(slide.img.src) === '.jpg') {
            base_lyr = await base_lyr.jpeg()
        }

        // if (to_file && path_to_save) {
        //     base_lyr.toFile(path_to_save)

        //     slide.img.pre_processed_path = path.relative(working_path, path_to_save)
        // } else if (to_file) {
        //     let pre_processed_img_path = full_image_path.split('.')
        //     pre_processed_img_path[pre_processed_img_path.length - 2] += '_pre-processed'
        //     pre_processed_img_path = pre_processed_img_path.join('.')
        //     base_lyr.toFile(pre_processed_img_path)

        //     slide.img.pre_processed_path = path.relative(working_path, pre_processed_img_path)
        // } else {
        //     slide.img.pre_processed_path = ''
        // }

        _callback(await base_lyr.toBuffer())
    }
}

// **********************************************************************
// **********************************************************************
// *********************** Sharp Helper Functions ***********************
// **********************************************************************
// **********************************************************************

function getSharpBlurredBuffer(image_path) {
    return sharp(image_path).resize(1080, 1350, { fit: "cover" }).blur(20).toBuffer()
}

function getSharpImage(image_path, reverse_fit = false) {
    return sharp(image_path)
        .resize(1080, 1350, { fit: (reverse_fit) ? "inside" : "cover" })
}

function getSharpImageBuffer(image_path, reverse_fit = false) {
    return getSharpImage(image_path, reverse_fit).toBuffer()
}


// ***********************************************************************
// ***********************************************************************
// *********************** Fabric Helper Functions ***********************
// ***********************************************************************
// ***********************************************************************

// Makes the rounded-corner blue rectangle
function fabricMakeRect(x, y, width, height) {
    return new fabric.Rect({
        left: x,
        top: y,
        width: width,
        height: height,
        fill: "rgba(44, 109, 195, 0.62)",
        rx: CORNER_RADIUS,
        ry: CORNER_RADIUS
    });
}

function fabricMakeTitleText(text) {
    return new fabric.Textbox(text, {
        // Will need to adjust positions
        left: 47 * 1.5,
        top: 47 * 1.5,
        fill: 'white',
        fontFamily: "Celebes",
        fontWeight: 'bold',
        fontStyle: 'italic',
        fontSize: 77,
        textAlign: 'center',
        // Color, horizontal offset, vertical offest, blur radius
        shadow: 'rgba(0,0,0,0.6) 0.92705px 2.853px 5px',
        width: 993 - 47,
        lineHeight: 0.9,
    })
}

function fabricMakeContentText(text = '') {
    text = text.replace(/\n*$/, '')

    const txt_box = new fabric.Textbox(text, {
        // Will need to adjust positions
        left: 47 * 1.5,
        // top: 1350 - content_height - 47 * 1.5,
        fill: 'white',
        fontFamily: "Celebes",
        textAlign: 'left',
        // Color, horizontal offset, vertical offest, blur radius
        shadow: 'rgba(0,0,0,0.6) 0.92705px 2.853px 5px',
        width: 993 - 47,
        fontSize: 50,
        lineHeight: 1,
        // fontWeight: 'bold',
        // fontStyle: 'italic',
    })

    txt_box.top = 1350 - txt_box.calcTextHeight() - 47 * 1.5;
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
    makeFullImage
}