// **************************************************
// **************************************************
// **************** ZOTERO FUNCTIONS ****************
// **************************************************
// **************************************************

// Promise resolves with bibliography or rejects with new credentials
function getBib(user_id, api_key, collection) {
    return new Promise((resolve, reject) => {
        if (user_id == null || api_key == null) {
            getCredentials(
                user_id,
                api_key
            )
                .then(reject)
        } else {
            let url;
            if (collection === undefined) {
                url = `https://api.zotero.org/users/${user_id}/items`
            } else {
                url = `https://api.zotero.org/users/${user_id}/collections/${collection}/items`
            }
            axios.get(url, {
                headers: {
                    'Zotero-API-Key': api_key
                },
                params: {
                    format: 'json',
                    include: 'data,bib',
                    style: 'ieee',
                    linkwrap: 1,
                    limit: 100,
                }
            })
                .then(r => {
                    resolve(getTrimmedBib(r.data))
                })
                .catch(e => {
                    let hint;
                    if (e?.response?.status === 500) {
                        hint = 'Your User ID may be incorrect'
                    } else {
                        hint = e?.response?.data
                    }
                    getCredentials(
                        user_id,
                        api_key,
                        hint
                    )
                        .then(reject)
                })
        }
    })
}

// Promise resolves with library collections array or rejects with new credentials
function getZoteroCollections(user_id, api_key) {
    return new Promise((resolve, reject) => {
        if (user_id == null || api_key == null) {
            getCredentials(
                user_id,
                api_key
            )
                .then(reject)
        } else {
            axios.get(`https://api.zotero.org/users/${user_id}/collections`, {
                headers: {
                    'Zotero-API-Key': api_key
                },
                params: {
                    format: 'json',
                }
            })
                .then(r => {
                    const formatted_collections = new Array()
                    for (const collection of r.data) {
                        formatted_collections.push({
                            key: collection.key,
                            name: collection.data.name,
                        })
                    }
                    resolve(formatted_collections)
                })
                .catch(e => {
                    let hint;
                    if (e?.response?.status === 500) {
                        hint = 'Your User ID may be incorrect'
                    } else {
                        hint = e?.response?.data
                    }
                    getCredentials(
                        user_id,
                        api_key,
                        hint
                    )
                        .then(reject)
                })
        }
    })
}

// Returns a promise that is resolved once the user has entered the correct user and API keys
function getCredentials(user_id, api_key, hint) {
    return new Promise((resolve, reject) => {
        const zotero_loader_cont = document.getElementById('zotero-credentials')

        while (zotero_loader_cont.hasChildNodes()) {
            zotero_loader_cont.removeChild(zotero_loader_cont.firstChild);
        }

        if (typeof hint === 'string') {
            zotero_loader_cont.innerHTML = `<div><b>Hint: </b>${hint}`
        }

        let template = document.createElement('template')
        template.innerHTML = `
        <p>Find your Zotero User ID <a href="https://www.zotero.org/settings/keys" target="_blank" rel="noreferrer noopener">here</a>.</p>
        <label for="zotero_user_id">User ID: </label>`.trim()
        zotero_loader_cont.appendChild(template.content.firstChild)

        const zotero_user_id_txt = document.createElement('input')
        zotero_user_id_txt.type = "text"
        zotero_user_id_txt.name = "zotero_user_id"
        zotero_user_id_txt.size = "7"
        zotero_user_id_txt.value = user_id
        zotero_loader_cont.appendChild(zotero_user_id_txt)

        template.innerHTML = `<p>Create your Zotero API Key <a href="https://www.zotero.org/settings/keys/new" target="_blank" rel="noreferrer noopener">here</a>. Remember to allow library read access.</p>
        <label for="zotero_api_key">API Key: </label>`.trim()
        zotero_loader_cont.appendChild(template.content.firstChild)

        const zotero_api_key_text = document.createElement('input')
        zotero_api_key_text.type = "text"
        zotero_api_key_text.name = "zotero_api_key"
        zotero_api_key_text.size = "24"
        zotero_api_key_text.value = api_key
        zotero_loader_cont.appendChild(zotero_api_key_text)

        const btn_container = document.createElement('div')
        const zotero_update_cred_btn = document.createElement('button')
        zotero_update_cred_btn.textContent = "Update Zotero Credentials"
        zotero_update_cred_btn.addEventListener('click', () => {
            zotero_loader_cont.classList.add('hidden')
            resolve({
                user_id: zotero_user_id_txt.value,
                api_key: zotero_api_key_text.value,
            })
        })

        btn_container.appendChild(zotero_update_cred_btn)
        zotero_loader_cont.appendChild(btn_container)
        zotero_loader_cont.classList.remove('hidden')
    })
}

// Gets the bibliography from Zotero and the citations - {key: order} pairs.
// Returns: text of the bibliography as i. bib[key].bib
function getWorksCitedText(bib, citations) {
    if (bib === null || bib === undefined || citations === {} || citations === undefined) {
        return '';
    }

    const list = new Array();
    for (const citation in citations) {
        list.push([citation, citations[citation]]);
    }
    list.sort((a, b) => a[1] - b[1])

    let bibliography = ''
    for (const [key, idx] of list) {
        bibliography += `${idx}. ${getTextFromKey(bib, key)}\n`
    }

    return bibliography.trim()
}

function getWorksCitedHTML(bib, citations) {
    if (bib === null || bib === undefined || citations === null || citations === undefined) {
        return '';
    }

    const list = new Array();
    for (const citation in citations) {
        list.push([citation, citations[citation]]);
    }
    list.sort((a, b) => a[1] - b[1])

    let bibliography = ''
    const parser = new DOMParser()
    for (const [key, idx] of list) {
        const bib_item = getItemByKey(bib, key)?.bib
        if(bib_item !== undefined){
            const citation = parser.parseFromString(bib_item.trim(), 'text/xml')
            citation.getElementsByClassName('csl-left-margin')[0].textContent = `[${idx}]`
            citation.firstChild.children[0].id = `@${key}`
    
            bibliography += citation.firstChild.outerHTML.trim()
        }
    }

    return bibliography
}

const getDOMFromXML = (() => {
    var parser = new DOMParser;
    return xml => parser.parseFromString(xml, 'text/xml').getElementsByClassName('csl-right-inline')[0]
})()

function getTextFromXML(xml) {
    return getDOMFromXML(xml).textContent
}


// Loops over list of Slides' QuillJs objects, returns key: idx pairs of citations
// Will also update the slide's Quill object to contain the right indexes
function getCitationIndexes(slide_list) {
    const citation_order = {}
    let total_idx = 0;
    for (const slide of slide_list) {
        if(slide?.content?.ops !== undefined){
            for (const item of slide?.content?.ops) {
                if (item.insert?.citation !== undefined) {
                    if (citation_order?.[item.insert.citation.key] === undefined) {
                        citation_order[item.insert.citation.key] = ++total_idx;
                    }
                    item.insert.citation.index = `${citation_order[item.insert.citation.key]}`
                }
            }
        }
    }
    return citation_order
}

function getCitationList(bib) {
    const list = new Array();
    for (const item of bib) {
        list.push({
            key: item.key,
            div: getDOMFromXML(item.bib).innerHTML
        })
    }
    return list
}

function getItemByKey(bib, key) {
    return bib.find(e => e.key === key)
}

function getTextFromKey(bib, key) {
    return getTextFromXML(getItemByKey(bib, key).bib)
}

function getTrimmedBib(bib) {
    const trimmed = new Array()
    for (const item of bib) {
        trimmed.push({
            bib: item.bib,
            key: item.key
        })
    }
    return trimmed
}

export {
    getCitationIndexes,
    getBib,
    getZoteroCollections,
    getCitationList,
    getWorksCitedText,
    getWorksCitedHTML
}