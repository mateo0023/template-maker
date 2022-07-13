// **************************************************
// **************************************************
// **************** ZOTERO FUNCTIONS ****************
// **************************************************
// **************************************************

function registerNewUser() {
    return new Promise((resolve, reject) => {

    })
}


// **************************************************
// **************************************************
// **************** HELPER FUNCTIONS ****************
// **************************************************
// **************************************************


// Loops over list of Slides' QuillJs objects, returns key: idx pairs of citations
function getCitationIndexes(slide_list) {
    // Ensure that it is a list (if a single slide is passed, make it a list)
    // slide_list = (slide_list instanceof Array) ? slide_list : [slide_list]

    const citation_order = {}
    let total_idx = 0;
    for (const slide of slide_list) {
        for (const item of slide.content.ops) {
            if (item.insert?.citation !== undefined && citation_order?.[item.insert.citation.key] === undefined) {
                citation_order[item.insert.citation.key] = ++total_idx;
            }
        }
    }
    return citation_order
}


export {
    getCitationIndexes
}