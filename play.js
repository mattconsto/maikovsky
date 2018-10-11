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

function generateMarkov(data) {
	/* Converts an array to a 1D Markov Chain */
	var chain = {};

	data.forEach(function(line) {
		for(var i = 0; i < line.length + 1; i++) {
			/* Use the empty string to track start and stop */
			var then = i > 0 ? line[i-1] : "";
			var now  = i < line.length ? line[i] : "";

			if(!(then in chain)) chain[then] = {total: 0};
			if(!(now in chain[then])) chain[then][now] = 0;

			chain[then][now] += 1;
			chain[then].total += 1;
		}
	})

	return chain;
}

function generateWord(chain) {
	var next = "", current = "", result = "";

	do {
		var number = randomInt(chain[current].total - 1);
		for(var character in chain[current]) {
			if(character === "total") continue;
			next = character;
			number -= chain[current][character];
			if(number <= 0) break;
		}
		result += next;
		current = next;
	} while(current !== "" && result.length <= 1000);

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
					result.music[part] += lines[i];
				}
			}

			return result;
		});
}

var tunes;
var instr = 1;
var title = "Untitled";
var meter = "4/4";
var key   = "C";
var music = "";
var abc   = "T:Untitled\nM:4/4\nK:C\n%%MIDI program 1";

function generateMusic() {
	if(typeof(tunes) === "undefined") return;

	title = generateWord(generateMarkov(tunes.map(function(tune) {return tune.meta.T;})));
	meter = randomPick(tunes.map(function(tune) {return tune.meta.M;}));
	key = randomPick(tunes.map(function(tune) {return tune.meta.K;}));
	music = generateWord(generateMarkov(tunes.map(function(tune) {return Object.values(tune.music)[0];})));
}

function generateABC() {
	abc = "T:" + title + "\nM:" + meter + "\nK:" + key + "\n%%MIDI program " + instr + "\n" + music;
	console.log(abc);
	ABCJS.renderAbc('notation', abc);
	ABCJS.renderMidi('midi', abc);
}

ajaxGET('music/jigs.abc', function(response) {
	tunes = parseABC(response);
	generateMusic();
	generateABC();
});
