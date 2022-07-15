// **************************************************
// **************************************************
// **************** ZOTERO FUNCTIONS ****************
// **************************************************
// **************************************************

const user_id = "9351589"
const client_key = "m1EOX4r47v8pHTAMm1j6Mnm2"

// Promise resolves with bibliography or rejects with new credentials
function getBib(user_id, api_key) {
    return new Promise((resolve, reject) => {
        axios.get(`https://api.zotero.org/users/${user_id}/items`, {
            headers: {
                'Zotero-API-Key': api_key
            },
            params: {
                format: 'json',
                include: 'data,bib',
                style: 'ieee'
            }
        })
            .then(r => {
                resolve(r.data)
            })
            .catch(e => {
                let hint;
                if(e?.response.status === 500){
                    hint = 'Your User ID may be incorrect'
                } else {
                    hint = e?.response.data
                }
                getCredentials(
                    user_id,
                    api_key,
                    hint
                )
                .then(reject)
            })
    })
}

// Returns a promise that is resolved once the user has entered the correct user and API keys
function getCredentials(user_id, api_key, hint) {
    return new Promise((resolve, reject) => {
        const zotero_loader_cont = document.getElementById('zotero-credentials')

        while (zotero_loader_cont.hasChildNodes()) {
            zotero_loader_cont.removeChild(zotero_loader_cont.firstChild);
        }

        if(typeof hint === 'string'){
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
    const list = new Array();
    for (const citation in citations) {
        list.push([citation, citations[citation]]);
    }
    list.sort((a, b) => a[1] - b[1])

    let bibliography = ''
    for (const [key, idx] of list) {
        bibliography += `${idx}. ${getTextFromKey(bib, key)}\n`
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

function getTilteByKey(bib, key) {
    const title = getItemByKey(bib, key).data.title
    return (title === undefined) ? '' : title
}

function getDateByKey(bib, key) {
    const date = getItemByKey(bib, key).data.date
    return (date === undefined) ? '' : date
}

function getAuthorsByKey(bib, key) {
    const getName = entry => (entry.firstName !== undefined) ? `${entry.firstName[0]}. ${entry.lastName}` : entry.name

    const authors = getItemByKey(bib, key).data.creators
    if (authors === undefined || authors.length === 0) {
        return ''
    } else if (authors.length > 4) {
        const lead = authors[0]
        return getName(authors[0]) + '<i>et al.</i>'
    } else {
        let names = ''
        for (let i = 0; i < authors.length - 1; i++) {
            names += getName(authors[i]) + ', '
        }
        names += getName(authors[authors.length - 1])
        return names
    }
}


export {
    getCitationIndexes,
    getBib,
    getCitationList,
    getWorksCitedText,
}