function ajaxGET(url, callback, error) {
	var request;
	request = new XMLHttpRequest();
	request.onreadystatechange = function() {
		if(this.readyState == 4) {
			if(this.status == 200) callback(this); else error(this);
		}
	};
	request.open("GET", url);
	request.send();
}

function randomInt(a, b) {
	/* Inclusive random numbers */
	var min, max;
	if(typeof(a) === "undefined") {
		min = 0, max = 9007199254740991 - 1;
	} else if (typeof(b) === "undefined") {
		min = 0, max = parseInt(a, 10);
	} else {
		min = parseInt(a, 10), max = parseInt(b, 10);
	}
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(list) {
	return list[Math.floor(Math.random() * list.length)];
}

function generateMarkov(data, length) {
	/* Converts an array to a nD Markov Chain */
	/* Each entry in the chain is a pair of [count, chain] */
	var chain = [0, {}];

	data.forEach(function(line) {
		for(var i = 0; i < line.length + 1; i++) {
			var target = chain;
			target[0] += 1;
			for(var l = length + 1; l >= 0; l--) {
				/* Use the empty string to track start and stop */
				var now = i >= l && i < line.length ? line[i-l] : "";
				/* Add if missing */
				if(!(now in target[1])) target[1][now] = [0, {}];
				/* Follow the chain */
				target = target[1][now];
				/* Increment count */
				target[0] += 1;
			}
		}
	});

	console.log(chain);
	return chain;
}

function generateWord(chain, length, limit) {
	var result = "";

	do {
		var target = chain;
		/* Descend until we cannot */
		for(var depth = length; depth >= 0; depth--) {
			var character = result.length > depth ? result[result.length-depth] : "";
			if(!(character in target[1]) || target[1][character][1].length <= 0) break;
			target = target[1][character];
		}
		
		/* Pick a character */
		var character;
		var number = randomInt(target[0]);
		for(character in target[1]) {
			number -= target[1][character][0];
			if(number <= 0) break;
		}
		result += character;
		if(character === "") break;
	} while(result.length <= limit);

	return result;
}

function parseABC(response) {
	/* Load ABC songbook into a useful data structure */
	return response
		.responseText
		.split(/\n\n+/)
		.map(function(text) {return text.replace("\r", "\n").trim();})
		.filter(function(text) {return text.length > 0;})
		.map(function(text) {
			var result = {meta: {}, music: {}};

			var lines = text
				.split("\n")
				.map(function(text) {return text.trim();})
				.filter(function(text) {return text.length > 0;});

			/* iteration order is important, this is not a simple mapping */
			var part = "A";
			for(var i = 0; i < lines.length; i++) {
				if(lines[i][0] === "%") {
					/* Ignore comments */
				} else if(lines[i].match(/P:.+/)) {
					/* Part */
					part = lines[i].substring(2);
				} else if(lines[i].match(/[FINrSX]:.+/)) {
					/* Ignore Meta */
				} else if(lines[i].match(/[A-Za-z]:.+/)) {
					/* Meta */
					result.meta[lines[i][0]] = lines[i].substring(2);
				} else {
					/* Tunes */
					if(!(part in result.music)) result.music[part] = "";
					if(result.music[part].length > 0) result.music[part] += "\n";
					result.music[part] += lines[i];
				}
			}

			return result;
		});
}

function stringDivider(str, width, breaker, spacer) {
	if (str.length > width) {
		var p = width;
		for (;p>0 && str[p]!=breaker;p--) {}
		if (p>0) {
			var left = str.substring(0, p);
			var right = str.substring(p+1);
			return left + spacer + stringDivider(right, width, spacer);
		}
	}
	return str;
}

var tunes;
var instr = 1;
var title = "Untitled";
var meter = "4/4";
var key   = "C";
var music = "";
var abc   = "T:Untitled\nM:4/4\nK:C";
var chords = false;
var iterations = 7;

function generateMusic() {
	if(typeof(tunes) === "undefined") return;

	var wordMarkov = generateMarkov(tunes.map(function(tune) {return tune.meta.T.replace(/[\(\)\[\]]/g, "");}), Math.round(iterations/2));
	for(var i = 0; (i === 0 || title.length < 3) && i < 200; i++) {
		title = generateWord(wordMarkov, Math.round(iterations/2), 30).substring(1).trim();
	}
	meter = randomPick(tunes.map(function(tune) {return tune.meta.M;}));
	key   = randomPick(tunes.map(function(tune) {return tune.meta.K;}));
	var musicMarkov = generateMarkov(tunes.map(function(tune) {
		/* Horrible isn't it */
		if(chords) return Object.values(tune.music)[0];

		return Object.values(tune.music)[0]
			.replace(/"[a-zA-Z\^=_]*"/g, "")
			.replace(/"/g, "")
			.replace(/\[[a-zA-Z0-9\^=_]\]/g, "")
			.replace(/[\[\d]/g, "");
	}), iterations);
	for(var i = 0; (i === 0 || music.length < 10) && i < 200; i++) {
		music = generateWord(musicMarkov, iterations, 500);
	}
	/* Force some new lines */
	music = music.split("\n").map(function(line) {return stringDivider(line, 40, "|", "|");}).join("\n");
}

function generateABC() {
	abc = "T:" + title + "\nM:" + meter + "\nK:" + key + "\nC:consto.uk\n" + music;
	// console.log(abc);
	ABCJS.renderAbc('notation', abc, {
		add_classes: true,
		responsive: "resize"
	});
	ABCJS.renderMidi('midi', abc, {
		inlineControls: {
			loopToggle: true,
			tempo: true,
		},
		program: instr,
		generateDownload: true,
		downloadLabel: "Download Midi",
		downloadClass: "download-link",
	});

	document.getElementById('notation').firstChild.addEventListener('click', function(event) {
		// console.log(event);
		if(event.target.innerHTML === title) {
			title = prompt("Please Enter a New Name", title) || title;
			generateABC();
		}
	})

	document.getElementById("editor").value = music;
	document.getElementById("download").href = "data:plain/text," + escape(abc);
	document.getElementById("download").download = escape(title.trim()).replace(/%../g, "-").replace(/--+/g, "-") + ".abc";
}

ajaxGET('music/jigs.abc', function(response) {
	tunes = parseABC(response);
	generateMusic();
	generateABC();
});
