////////////////////////////////////////////////////////////////
//  파일 : preload.js                                         //
//  작성자 : mobbing                                          //
//  주석 : DOM이 로드되기 전 처리할 스크립트                    //
///////////////////////////////////////////////////////////////

const path = require('path');
const fs = require('fs');
const app = require('electron').remote.app;
const { clipboard, shell } = require('electron');
const EventEmitter = require('events');
const WebSocketServer = require('websocket').server;
const http = require('http');


/**
 * @function getPath
 * @param {string} path_ 
 * 현재 프로그램이 시작된 경로를 기준으로,
 * @path_ 의 절대 경로를 반환한다.
 */
const getPath = (path_) => {
	return path.join(app.getAppPath(), path_);
};

const file2JSON = (file) => {
	if ( file ) {
		return eval(`(function(){ return ${fs.readFileSync(file, {encoding:'utf8'})} })()`)
	}
};

/**
* @function logging 
* @param {String} str
* 문자열로 받은 str을 console-output 에다가 추가를 한다.
*/
const logging = (str, lang = "javascript") => {
	let row = document.createElement('div');
	row.className = "row";
	let colLeft = document.createElement('div');
	colLeft.className = "col-12";
	
	let p = document.createElement('pre');
	p.className = "text-light";
	p.style = "overflow:hidden; white-space: pre-wrap;";
	
	let code = document.createElement('code');
	code.className = lang
	code.innerText = str;
	
	hljs.highlightBlock(code);
	
	p.appendChild(code);
	colLeft.appendChild(p);
	row.appendChild(colLeft);
	document.querySelector('#console-output').appendChild(row);
	
	if (document.querySelector('#console-scroll-fix').checked) {
		document.querySelector('#console-output').scrollTop = 
		document.querySelector('#console-output').scrollHeight;
	}
};

/**
 * @type {Object}
 * 좌측 하단에 정보를 띄웁니다.
 */
const noti = {
	error : (errString) => {
		UIkit.notification({
			message: '<span uk-icon="icon: close"></span>&nbsp;'+
			'<label class="uk-text-small">에러 : <span class="uk-text-danger">' + errString + '</span></label>',
			pos: 'bottom-left'
		});
		console.error(errString);
	},
	success : (title, message) => {
		UIkit.notification({
			message: '<span uk-icon="icon: check"></span>&nbsp;'+
			`<label class="uk-text-small">${title} : <span class="uk-text-success">${message}</span></label>`,
			pos: 'bottom-left'
		});
	},
	info : (title, message) => {
		UIkit.notification({
			message: '<span uk-icon="icon: plus-circle"></span>&nbsp;'+
			`<label class="uk-text-small">${title} : <span class="uk-text-spoon">${message}</span></label>`,
			pos: 'bottom-left'
		});
	}
};

/**
 * @function readFolder
 * @param {string} path_
 * path_가 폴더라면 하위 폴더에 있는 내용까지 전부 탐색하여,
 * 결과값을 반환한다.
 */
const readFolder = (path_ = app.getAppPath()) => {
	let dir = fs.lstatSync(path_);
	let rtn = {files: [], folders: {}};
	if ( dir && dir.isDirectory() ) {
		let dirInfo = fs.readdirSync(path_);
		dirInfo.forEach(f => {
			let p = path.join(path_,f);
			let d = fs.lstatSync(p);
			if ( d && d.isDirectory() ) {
				rtn.folders[p] = readFolder(p);
			} else {
				rtn.files.push(p);
			}
		});
	}
	return rtn;
};

/**
 * @function copyAtag
 * @param {HTMLElement} element 
 * @param {boolean} skipFlag
 * A Tag의 텍스트를 복사한다.
 * skipFlag가 true면 왼쪽 아래의 메시지를 띄우지 않는다.
 */
const copyAtag = (element, skipFlag = false) => {
	let text = element.innerText;
	if ( text ) {
		clipboard.writeText(text);
		if ( !skipFlag ) {
			noti.info("복사되었습니다.", text);
		}
	}
};

/**
 * NavBar의 사이즈를 panel의 크기에 맞게 재정비한다.
 * +++ codeDiv 의 사이즈도 맞춘다.
 */
const refreshNavSize = () => {
	let nav = document.querySelector('nav');
	let panel = document.querySelector('#ContainerPanel>div[name="panel1"]');

	if ( nav && panel ) {
		nav.style.width = panel.offsetWidth+"px";
	}

	let codeDiv = document.querySelector('#codeDiv');
	if ( codeDiv ) {
		codeDiv.style.width = (panel.offsetWidth - 200)+"px";
	}
};

/**
 * appendImport 는 부모가 될 HTMLElement에,
 * @target 으로 넘겨준 선택자 또는 HTMLElement 를 이용하여, import 태그를 찾는다.
 * 찾으면, 해당 태그 안 import-child div 를 부모 노드에 appendChild로 추가한다.
 */
HTMLElement.prototype.appendImport = function(target, query, cb) {
	if ( typeof query === "function" ) {
		cb = query;
	}

	if ( typeof query !== "string" ) {
		query = 'div[name="import-child"]';
	}

	let t = target;
	if ( typeof target === "string" ) {
		t = document.querySelector(target);
	}
	
	let child = null;
	if ( t.import instanceof Document ) {
		child = t.import.querySelector(query);
		if ( child ) {
			//child = child.cloneNode(true);
			this.appendChild(child);
		}
	}

	if ( typeof cb === "function" ) {
		cb(this, child);
	}
};

/**
 * @function htmlToElements
 * html문자열을 HTMLElement 타입으로 변환하여 반환한다.
 */
String.prototype.htmlToElements = function() {
	let dummy = document.createElement('div');
	dummy.innerHTML = this;
	return dummy;
};

/**
 * @function getObject
 * @param {String} key
 * '.' 를 기준으로 key 하위 오브젝트를 한 번에 반환한다.
 */
const getObject = (obj, key, midx=0, rtn = obj) => {
	if ( Array.isArray(key) ) {
		if ( rtn === undefined || key.length-midx <= 0 ) {
			if ( key.length > 0 ) {
				return {d: rtn, k: key[0]};
			}
			return rtn;
		} else {
			rtn = rtn[key.shift()];	
		}
	} else if ( typeof key === "string" ) {
		key = key.split('.');
	}
	return getObject(obj, key, midx, rtn);
};

/**
 * @function fullStringify
 * @param {Object} obj 문자열화 할 객체
 * @param {String} rtn 사용되지 않음
 * @description 오브젝트 전체를 문자열화 하여 보여준다.
 * 함수, 그 안에 있는 객체까지도.
 */
const fullStringify = (obj, rtn = "{") => {
	console.log(obj);
	let oKeys = Object.keys(obj);
	oKeys.forEach((k,i) => {
		rtn += `"${k}":`;
		switch ( typeof obj[k] ) {
			case "object": {
				if ( Array.isArray(obj[k]) ) {
					rtn += JSON.stringify(obj[k]);
				} else {
					rtn += fullStringify(obj[k]);
				}
			} break;
			case "string": {
				rtn += `"${obj[k].toString().replace(/\\/, "\\\\")}"`;
			} break;
			default: {
				rtn += obj[k].toString();
			}
		}
		if ( i < oKeys.length-1 ) {
			rtn += ',';
		}
	});
	rtn += '}';
	return rtn;
}

const loadScript = () => {
	let script = document.querySelector('#sopia-main');
	if ( script ) {
		$(script).remove();
		script = null;
	}

	Object.keys(sopia.itv).forEach(key => sopia.itv.reload(key));	

	script = document.createElement('script');
	script.id = "sbot-main";
	script.src = getPath('s-bot/main.js');
	script.type = "text/javascript";

	document.body.appendChild(script);
}

//sopia 객체 로딩
const sopia = require(getPath('./src/resources/js/sopia.js'));