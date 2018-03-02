'use strict';

console.log(this);

var ts;
if (zs4.is.node()){
  ts = this;
}
if (zs4.is.window()){
  ts = new Object();
}

const SEMI_TONES_PER_OCTAVE=12;
const MIN_TICKS_PER_BEAT=2;
const MAX_TICKS_PER_BEAT=23;
const MIN_BEATS_PER_BAR=2;
const MAX_BEATS_PER_BAR=23;
const MAX_BEATS_PER_MINUTE=240;
const MIN_BEATS_PER_MINUTE=24;

const KBM_EVENT = 0;
const KBM_LYRIC = 1;
const KBM_CHORD = 2;
const KBM_MELODY = 3;
const KBM_BAR = 4;
const KBM_BEAT = 5;

ts.sequence = new Array();

ts.create = function(){
  var SEQ = this;
  ts.sequence.push(SEQ);

	SEQ.ts = ts;
  SEQ.abc = new ts.abc();
	SEQ.arg = new Object({});
	SEQ.evt = new Array();
	SEQ.tool = new Array();
	SEQ.inst = new Array();
	SEQ.toolobject = new Object({});
	SEQ.instobject = new Object({});
	SEQ.bpb = 4;
	SEQ.bpm = 120;
	SEQ.tpb = 3;
  SEQ.layoutlinefeed = true;
	SEQ.stats = new Object({
		chords:0,
		bars:0,
		beats:0,
    notes:0,
    lyric:0,
    linefeed:0,
    space:0,

		countChords:0,
		countBars:0,
		countBeats:0,
    countNotes:0,
    countLyric:0,
    countSpace:0,
    countLinefeed:0,

    melodyMax:0,
    melodyMin:127,
    noteMelody:[0,0,0,0,0,0,0,0,0,0,0,0],
    noteChord:[0,0,0,0,0,0,0,0,0,0,0,0],
    noteBass:[0,0,0,0,0,0,0,0,0,0,0,0],
    noteStats:[0,0,0,0,0,0,0,0,0,0,0,0],
    chordStat:null,
		currentBar:null,
		currentBeat:null,
		start:function(){
      var STATS = this;

      this.melodyMax = 0;
      this.melodyMin = 127;
      for (var i=0;i<12;i++){this.noteMelody[i]=this.noteChord[i]=this.noteBass[i]=0;}
      STATS.chordStat = new Object({
        all:new Array(),
        add:function(c){
          var found = -1;
          for (var i = 0 ; i < this.all.length;i++){
            if (c.v == this.all[i].v && c.t==this.all[i].t){found=i;break;}
          }
          if (found==-1){
            found = this.all.length;
            this.all.push(new Object(c));
          }
          if (this.all[found].count==null)this.all[found].count=0;
          this.all[found].count++;

          STATS.noteBass[c.b]++;

          var a = ts.music.CHORD.TYPE[c.t].a;
          for (var i = 0;i<a.length;i++){
            if (a[i]==true) STATS.noteChord[(c.v+i)%12]++;
          }

        },
      });
			this.currentBar = null;
			this.currentBeat = null;
			this.countChords =
      this.countBars =
      this.countBeats =
      this.countLyric =
      this.countLinefeed =
      this.countSpace =
      this.countNotes = 0;
		},
		countEvent:function(e){
      var STATS = this;
			e.duration = 0;
      var music_done = false;
			if (e.isBar()) {
				STATS.countBars++;
				STATS.currentBar = e;
				STATS.currentBeat = e;
				STATS.currentBar.bar.beats = [e];
        STATS.currentBar.bar.events = [e];
        STATS.currentBar.bar.chords = [];
        STATS.currentBar.bar.melodies = [];
        STATS.currentBar.bar.music = [e];

				STATS.countBeats++;
				STATS.currentBeat.beat = {
					events:[e],
          chords:[],
          melodies:[],
          music:[e],
				};
        music_done=true;
			}
			else if (e.isBeat()){
				STATS.countBeats++;
				STATS.currentBeat = e;

				STATS.currentBeat.beat = {
					events:[e],
          chords:[],
          melodies:[],
          music:[e],
				};

				if (STATS.currentBar != null){
					STATS.currentBar.bar.beats.push(e);
          STATS.currentBar.bar.events.push(e);
          STATS.currentBar.bar.music.push(e);
				}
        music_done=true;
			}
			else {
				if (STATS.currentBar != null){
					STATS.currentBar.bar.events.push(e);
				}

				if (STATS.currentBeat != null){
					STATS.currentBeat.beat.events.push(e);
				}
			}

			if (e.isChord()){
				STATS.countChords++;
        STATS.chordStat.add(e.chord);
        if (STATS.currentBar != null){
          STATS.currentBar.bar.chords.push(e);
          if (!music_done)STATS.currentBar.bar.music.push(e);
				}

				if (STATS.currentBeat != null){
          STATS.currentBeat.beat.chords.push(e);
          if (!music_done)STATS.currentBeat.beat.music.push(e);
				}
        music_done=true;
			}

			if (e.isMelody()){
        if (STATS.melodyMax<e.melody)STATS.melodyMax=e.melody;
        if (STATS.melodyMin>e.melody)STATS.melodyMin=e.melody;
        STATS.noteMelody[e.melody%12]++;

				this.countNotes++;
        if (STATS.currentBar != null){
          STATS.currentBar.bar.melodies.push(e);
          if (!music_done)STATS.currentBar.bar.music.push(e);
				}

				if (STATS.currentBeat != null){
          STATS.currentBeat.beat.melodies.push(e);
          if (!music_done)STATS.currentBeat.beat.music.push(e);
				}
        music_done=true;
			}

      if (e.space) this.countSpace++;
      if (e.linefeed) this.countLinefeed++;
      if (e.isLyric()) this.countLyric++;
		},
		end:function(){
      var STATS = this;
			this.chords = this.countChords;
			this.bars = this.countBars;
			this.beats = this.countBeats;
      this.notes = this.countNotes;
      this.lyric = this.countLyric;
      this.linefeed = this.countLinefeed;
      this.space = this.countSpace;
      for (var i=0;i<12;i++){this.noteStats[i]=this.noteMelody[i]+this.noteChord[i]+this.noteBass[i];}

      this.result = new Object();

      if (this.chords==0 && this.notes==0)this.result.tone = false;
      else this.result.tone = true;

      if (this.bars==0&&this.beats==0)this.result.time = false;
      else this.result.time = true;

      if (!this.result.time && !this.result.tone) this.result.music = false;
      else  this.result.music = true;

      if (this.lyric == 0)this.result.words = false;
      else this.result.words = true;

      if (this.result.tone==true){
        if (this.chords>0){
          SEQ.guessedKeys = ts.music.guess.key.from.noteStats(this.noteChord);
        }
        else {
          SEQ.guessedKeys = ts.music.guess.key.from.noteStats(this.noteStats);
        }
        SEQ.abc.noteTableCreate(SEQ.guessedKeys[0].n + SEQ.guessedKeys[0].s.t);
      }
      else {
        SEQ.guessedKeys = ts.music.guess.key.from.noteStats([1,0,1,0,1,1,0,1,0,1,0,1]);
        SEQ.abc.noteTableCreate(SEQ.guessedKeys[0].n + SEQ.guessedKeys[0].s.t);
      }

      //console.log(STATS);
		},
	});
	SEQ.key = ts.music.parse.chord("");
	SEQ.evt_current = null;
	SEQ.evt_curidx = -1;
	SEQ.evt_shown = null;
	SEQ.current_tool = null;
	SEQ.current_inst = null;
  SEQ.kbm = KBM_EVENT;
  SEQ.kb = new Object({
    pos:'start',
    chord:null,
    ctp:function(){
      if (this.pos>1){
        var v = ts.music.parse.note(SEQ.kb.chord.substr(0,2));
        if (v != -1)return 2;
        v = ts.music.parse.note(SEQ.kb.chord.substr(0,1));
        if (v != -1)return 1;
      }
      else if (this.pos>0){
        var v = ts.music.parse.note(SEQ.kb.chord.substr(0,1));
        if (v != -1)return 1;
      }
      return -1;
    },
    ctb:function(){
      var ctp = this.ctp();
      return ts.music.CHORD.checkTypeBeginning(this.chord.substr(ctp,this.pos-ctp));
    },
  });
  SEQ.isPlaying = function(){if(SEQ.player!=null)return true;return false;};
	SEQ.onKeyChange = function(nuKee){
		if	(!this.key.ok)
			return;

		nuKee = parseInt(nuKee);

		var delta = nuKee - this.key.v;
		this.key.v = nuKee;

		this.transpose(delta);
	};
	SEQ.showEventAsCurrent = function(e){
    return null;
    if (!zs4.is.window())return null;
		if ( this.evt_shown != null ){
			this.evt_shown.className = '';
		}

		if (e == null){
			return null;
		}

		this.evt_shown = e;
		return e;
	};
	SEQ.setCurrentEvent = function(evt){
		//var playing = SEQ.isPlaying();

    if (SEQ.evt_current != null){
      SEQ.evt_current.current=false;
      SEQ.evt_current.refresh();
    }

		SEQ.evt_current = evt;
    SEQ.evt_current.current=true;
    SEQ.evt_current.refresh();

    SEQ.evt_curidx = -1;
		for (var i = 0 ; i < this.evt.length ; i++){
      SEQ.evt[i].index = i;
			if (evt == SEQ.evt[i]){
				SEQ.evt_curidx = i;
			}
      else {
        SEQ.evt[i].current=false;
      }
		}

    SEQ.evt_current.refresh();

		if (SEQ.current_tool != null && !SEQ.isPlaying()){
			SEQ.current_tool.refresh();
		}
		if (SEQ.current_inst != null && !SEQ.isPlaying()){
			SEQ.current_inst.refresh();
		}

	};
	SEQ.getEventIndex = function(evt){
		for (var i = 0 ; i < SEQ.evt.length ; i++){
			if (evt == SEQ.evt[i])
			return i;
		}

		return 0;
	};
	SEQ.setNextEvent = function(){
		SEQ.setCurrentEvent(SEQ.evt[((SEQ.evt_curidx+1) % SEQ.evt.length)]);
	};
	SEQ.setPreviousEvent = function(){
		SEQ.setCurrentEvent(SEQ.evt[((SEQ.evt_curidx+SEQ.evt.length-1) % SEQ.evt.length)]);
	};

  SEQ.searchNextEvent = function(from,testEvent){
    if (SEQ.evt.length==0)return from;
    if (!zs4.is.function(testEvent))return ((SEQ.evt_curidx+1) % SEQ.evt.length);
    var start = from;
		if (start == null) start = SEQ.evt_curidx;
		start %= SEQ.evt.length;
		start += SEQ.evt.length;

		for (var i = 0 ; i < SEQ.evt.length ; i++){
			start++;
			var idx = (start%SEQ.evt.length);
			if (testEvent(SEQ.evt[idx]))
				return idx;
		}

		return from;
	};
	SEQ.searchPrevEvent = function(from,testEvent){
    if (SEQ.evt.length==0)return from;
		if (!zs4.is.function(testEvent))return ((SEQ.evt_curidx+SEQ.evt.length-1) % SEQ.evt.length);
    var start = from;
		if (start == null) start = SEQ.evt_curidx;
		start %= SEQ.evt.length;
		start += SEQ.evt.length;

		for (var i = 0 ; i < this.evt.length ; i++){
			start--;
			var idx = (start%SEQ.evt.length);
      if (testEvent(SEQ.evt[idx]))
				return idx;
		}

		return from;
	};
	SEQ.searchPrevBar = function(from){
    return SEQ.searchPrevEvent(from,function(evt){if (evt.bar)return true; return false});
	};
	SEQ.searchNextBar = function(from){
    return SEQ.searchNextEvent(from,function(evt){if (evt.bar)return true; return false});
	};
  SEQ.searchPrevBeat = function(from){
    return SEQ.searchPrevEvent(from,function(evt){if (evt.beat)return true; return false});
	};
	SEQ.searchNextBeat = function(from){
    return SEQ.searchNextEvent(from,function(evt){if (evt.beat)return true; return false});
	};
  SEQ.searchPrevChord = function(from){
    return SEQ.searchPrevEvent(from,function(evt){
      if (zs4.is.object(evt.chord)&&evt.chord.ok)return true; return false
    });
	};
	SEQ.searchNextChord = function(from){
    return SEQ.searchNextEvent(from,function(evt){
      if (zs4.is.object(evt.chord)&&evt.chord.ok)return true; return false
    });
	};
  SEQ.searchPrevNote = function(from){
    return SEQ.searchPrevEvent(from,function(evt){
      if (evt.melody!=0)return true; return false
    });
	};
	SEQ.searchNextNote = function(from){
    return SEQ.searchNextEvent(from,function(evt){
      if (evt.melody!=0)return true; return false
    });
	};
  SEQ.searchPrevLyric = function(from){
    return SEQ.searchPrevEvent(from,function(evt){
      if (evt.lyric.trim()!='')return true; return false
    });
	};
	SEQ.searchNextLyric = function(from){
    return SEQ.searchNextEvent(from,function(evt){
      if (evt.lyric.trim()!='')return true; return false
    });
	};
  SEQ.searchPrevSpace = function(from){
    return SEQ.searchPrevEvent(from,function(evt){
      if (evt.space)return true; return false
    });
	};
	SEQ.searchNextSpace = function(from){
    return SEQ.searchNextEvent(from,function(evt){
      if (evt.space)return true; return false
    });
	};
  SEQ.searchPrevLinefeed = function(from){
    return SEQ.searchPrevEvent(from,function(evt){
      if (evt.linefeed)return true; return false
    });
	};
	SEQ.searchNextLinefeed = function(from){
    return SEQ.searchNextEvent(from,function(evt){
      if (evt.linefeed)return true; return false
    });
	};
	SEQ.searchActiveChord = function(from){
		if (SEQ.evt.length == 0 || SEQ.evt_current == null)
			return null;

		if (SEQ.evt_current.chord)
			return SEQ.evt_current.chord;

		for (var i = (SEQ.evt.length-1) ; i > 0; i--){
			var idx = ((SEQ.evt_curidx+i)%SEQ.evt.length);
			if (SEQ.evt[idx].chord)
				return SEQ.evt[idx].chord;
		}

		return from;
	};
	SEQ.transpose = function(delta){

		for ( var i = 0 ; i < SEQ.evt.length ; i++ ){
			var evt = SEQ.evt[i];
			// if this event has a chord
			if (evt.chord!=null){
				evt.chord.v = ts.music.transpose.note.name(evt.chord.v,delta)
				evt.chord.b = ts.music.transpose.note.name(evt.chord.b,delta)
			}

			if (evt.melody != 0){
				evt.melody += delta;
			}
		}
		this.refresh();
	};
	SEQ.updateStats = function(){
    for ( var i = 0 ; i < SEQ.evt.length ; i++ )SEQ.evt[i].index=i;
		SEQ.stats.start();
    var bar = SEQ.searchNextBar(SEQ.evt.length-1);
		for ( var i = 0 ; i < SEQ.evt.length ; i++ ){
      var idx = (i+bar)%SEQ.evt.length;
			SEQ.evt[idx].duration = 0;
			SEQ.evt[idx].refresh();
			SEQ.stats.countEvent(SEQ.evt[idx]);
		}
		SEQ.stats.end();

    if (SEQ.evt.length > 0){

      var bar = null, beat = null, chord = null, melody = null, text = null;
      for ( var idx = 0 ; idx <= (SEQ.evt.length+1); idx++){
        var i = idx % SEQ.evt.length;
        var e = SEQ.evt[i];
        if (e.isBar()){if (bar!=null) e.prevBar = bar; bar = e; }
        if (e.isBeat()){if (beat!=null) e.prevBeat = beat; beat = e; }
        if (e.isChord()){if (chord!=null) e.prevChord = chord; chord = e; }
        if (e.isMelody()){if (melody!=null) e.prevMelody = melody; melody = e; }
        if (e.isLyric()||e.isSpace()){if (text!=null) e.prevText = text; text = e; }
      }

      bar = null; beat = null; chord = null; melody = null; text = null;
      for ( var idx = SEQ.evt.length ; idx >= 0; idx--){
        var i = idx % SEQ.evt.length;
        var e = SEQ.evt[i];
        if (e.isBar()){if (bar!=null) e.nextBar = bar; bar = e; }
        if (e.isBeat()){if (beat!=null) e.nextBeat = beat; beat = e; }
        if (e.isChord()){if (chord!=null) e.nextChord = chord; chord = e; }
        if (e.isMelody()){if (melody!=null) e.nextMelody = melody; melody = e; }
        if (e.isLyric()||e.isSpace()){if (text!=null) e.nextText = text; text = e; }
      }

    }

	};
	SEQ.recomputeTiming = function(){
		SEQ.updateStats();
		var seq = SEQ;
		SEQ.barTotalMillies = Math.round(SEQ.bpb * (60000/SEQ.bpm));
    SEQ.beatMillies = Math.round(SEQ.barTotalMillies/SEQ.bpb);
    SEQ.barTicks = Math.round(SEQ.bpb*SEQ.tpb);
    SEQ.tickMillies = Math.round(SEQ.barTotalMillies/SEQ.barTicks);
    while ((SEQ.tickMillies*SEQ.barTicks)<SEQ.barTotalMillies)SEQ.tickMillies += 1;

    //zs4.debug('SEQ.barTotalMillies='+SEQ.barTotalMillies);
    //zs4.debug('SEQ.beatMillies='+SEQ.beatMillies);
    //zs4.debug('SEQ.barTicks='+SEQ.barTicks);
    //zs4.debug('SEQ.tickMillies='+SEQ.tickMillies);

		var title = '';

		function processBeat(beat,no,length){

			var tit = 'beat:'+ (no+1) +' length:'+length;
			if (SEQ.evt[beat].bar==null && SEQ.evt[beat].beat!=null){
				if (zs4.is.window())SEQ.evt[beat].eBlockChart.title = tit;
			}
			SEQ.evt[beat].duration = length;

			//if (seq.evt[beat].beat==null)zs4.debug('beat with no beat');
			// count beat events
			var eCount = 0;
			for (var c = beat ; c < (beat+SEQ.evt.length); c++){
				var ci = (c+SEQ.evt.length)%SEQ.evt.length;

				if (SEQ.evt[ci].hasMusic()) eCount++;

				// loop control
				ci = (ci+1+SEQ.evt.length)%SEQ.evt.length;
				if (SEQ.evt[ci].beat) break;
			}

			if (eCount > 1){
				var eDur = Math.round(length/eCount);
				for (var c = beat ; c < (beat+seq.evt.length) && eCount>0; c++){
					var ci = (c+seq.evt.length)%seq.evt.length;
					if (seq.evt[ci].hasMusic()) {

						eCount--
						if (eCount==0){
							seq.evt[ci].duration = length;
							break;
						}
						else {
							seq.evt[ci].duration = eDur;
							length -= eDur;
						}
					};

					// loop control
					ci = (ci+1+seq.evt.length)%seq.evt.length;
					if (seq.evt[ci].beat) break;
				}
			}

		}

		if (SEQ.stats.bars > 0){
			var cur_bar = SEQ.searchNextBar(this.evt.length-1);
			var countObject = new Object({
				events:0,
				beats:0,
        notes:0,
        chords:0,
			});

			for (var b = 0; b < SEQ.stats.bars; b++){
				title = 'bar '+(b+1)+' ';
				var beatNo = 0;

				// count beats and events in current bar
				countObject.events = countObject.beats = countObject.notes = countObject.chords = 0;
				for (var c = cur_bar ; c < (cur_bar+SEQ.evt.length); c++){
					var ci = (c+SEQ.evt.length)%SEQ.evt.length;
					countObject.events++;
					if (SEQ.evt[ci].isBeat()) countObject.beats++;
          if (SEQ.evt[ci].isMelody()) countObject.notes++;
          if (SEQ.evt[ci].isChord()) countObject.chords++;

					// loop control
					ci = (ci+1+SEQ.evt.length)%SEQ.evt.length;
					if (SEQ.evt[ci].bar) break;
				}
				title += ' beats:'+countObject.beats
              +' events:'+countObject.events
              +' notes:'+countObject.notes
							+' chords:'+countObject.chords;

				if (countObject.beats == this.bpb){
					beatNo = 0;
					for (var c = cur_bar ; c < (cur_bar+SEQ.evt.length); c++){
						var ci = (c+this.evt.length)%this.evt.length;
						if (this.evt[ci].isBar()&&ci!=cur_bar)break;
						if (this.evt[ci].isBeat()) {
							if (beatNo==0) {title += ' length:'+SEQ.beatMillies;}
							processBeat(ci,beatNo,SEQ.beatMillies);
							beatNo += 1;
						}
					}
				}
				else {
					var bMils = SEQ.beatMillies;
					var couBeats = countObject.beats;
					var bpb = SEQ.bpb;

					while (couBeats>bpb) bpb+=SEQ.bpb;
					var bMils = Math.round(SEQ.barTotalMillies/bpb);

					var beatNo = 0; var bpbUsed = 0;
					var timePerBeat = SEQ.barTotalMillies/couBeats;
					for (var c = cur_bar ; c < (cur_bar+SEQ.evt.length); c++){
						var ci = (c+SEQ.evt.length)%SEQ.evt.length;
						if (SEQ.evt[ci].isBar()&&ci!=cur_bar)break;
						if (SEQ.evt[ci].isBeat()){
							var target = (beatNo+1) * timePerBeat;

							var bpbThis = 0;
							var bpbUsedBefore = bpbUsed;
							//zs4.debug('timePerBeat:'+ timePerBeat + ' target:' + target);
							for (var x = bpbUsed ; x < bpb; x++) {
								var diff =  Math.round(Math.abs(((bpbUsed*bMils)-target))%bMils);
								//zs4.debug('distance of ' +(bpbUsed)+'/'+(couBeats)+' beat is '+diff);
								var diff_if_addbeat = Math.round(Math.abs((((bpbUsed+1)*bMils)-target))%bMils);
								//zs4.debug('distance of ' +(bpbUsed+1)+'/'+(couBeats)+' beat is '+diff_if_addbeat);
								if (diff_if_addbeat <= diff){
									bpbUsed += 1;
									bpbThis += 1;
									if ((bpbUsed*bMils)>=target)break;
								}
								else break;
							}
							//zs4.debug('bpbUsed:'+bpbUsed+' bpbThis:'+bpbThis);
							if (beatNo==0) {title += ' length:'+(bpbThis*bMils);}
							processBeat(ci,beatNo,bpbThis*bMils);
							beatNo += 1;
						}
					}
				}

				if (zs4.is.window())SEQ.evt[cur_bar].eBlockChart.title = title;
				cur_bar = SEQ.searchNextBar(cur_bar);
			}
		}
	};
  SEQ.recomputeBar = function(e){
    var tix = SEQ.barTicks;

    e.playArray = new Array();

    // create a tick-grid
    var starttime = 0;
    var available_bar = SEQ.barTotalMillies;
    for (var b = 0; b < SEQ.bpb; b++){
      var available_beat = SEQ.beatMillies;
      if (b == (SEQ.bpb-1)) available_beat = available_bar;
      available_bar -= available_beat;

      for (var t = 0; t < SEQ.tpb; t++){
        var available_tick = SEQ.tickMillies;
        if (t == (SEQ.tpb-1))available_tick = available_beat;
        available_beat -= available_tick;

        e.playArray.push(new Object({
          starttime:starttime,
          ticktime:available_tick,
          chordCount:new Array(),
          melodyCount:new Array(),
        }));
        starttime += available_tick;
      }

    }
    //zs4.debug('total duration: '+starttime)

    // spread out the beats;
    var bcount = e.bar.beats.length;
    var tix_available = tix;
    var tpos = 0;
    var tpb = tix/bcount; //Math.round(tix/bcount);98u
    for (var b = 0; b < bcount; b++){
      var beat = e.bar.beats[b];
      var bstart = tpos;
      var blength = tpb
      if (b==(bcount-1))blength=tix_available;
      tpos += blength;
      tix_available -= blength;

      // count music events
      var a = new Array();
      for (var m = 0; m < beat.beat.events.length; m++){
        if (beat.beat.events[m].hasMusic())a.push(beat.beat.events[m])
      }
      //zs4.debug('bstart='+bstart+' blength='+blength+' musicEvents='+a.length);

      var m_pos = bstart;
      var m_available = blength;
      var tpe_float = blength/a.length;
      for (var m = 0; m < a.length;m++){
        var start = Math.round((m*tpe_float)+bstart);
        if (start >= e.playArray.length)start--;
        //zs4.debug('musicEvent '+m+' starts on tick '+start);
        if (a[m].isChord()){
          e.playArray[start].chord = (a[m]);
          e.playArray[start].chordCount.push(a[m]);
        }

        if (a[m].isMelody()){
          e.playArray[start].melody = (a[m]);
          e.playArray[start].melodyCount.push(a[m]);
        }
      }

    }

    // concoct a melody summary
    e.arrayMelody = new Array();
    for (var i = 0 ; i < tix; i++) {
      var a = e.playArray[i].melodyCount;
      var tickstart = e.playArray[i].starttime;
      var ticklength = e.playArray[i].ticktime;
      var count = e.playArray[i].melodyCount.length;
      if (count>0){
        var start = tickstart;
        var available = ticklength;
        var slice = Math.round(available/count);
        for (var c = 0; c < a.length; c++){
          var event = a[c];
          var starttime = start+(c*slice);
          var ticktime = Math.round(available/(a.length-(c)));
          available -= ticktime;
          //tick.arr.push(new Object({
          e.arrayMelody.push(new Object({
            starttime:starttime,
            ticktime:ticktime,

            //debug
            //ticklength:ticklength,
            //slice:slice,

            event:a[c],
          }));
        }
      }
    }

    for (var i = 0 ; i < e.arrayMelody.length; i++) {
      if (i == (e.arrayMelody.length-1)){
        e.arrayMelody[i].ticktime = SEQ.barTotalMillies-e.arrayMelody[i].starttime;
      }
      else {
        e.arrayMelody[i].ticktime = e.arrayMelody[i+1].starttime-e.arrayMelody[i].starttime;
      }
    }

    // concoct a chord summary
    e.arrayChords = new Array();
    for (var i = 0 ; i < tix; i++) {
      if (e.playArray[i].chord!=null){
        e.arrayChords.push(new Object({
          starttime:e.playArray[i].starttime,
          ticktime:e.playArray[i].ticktime,
          event:e.playArray[i].chord,
        }));
      }
    }

    for (var i = 0 ; i < e.arrayChords.length; i++) {
      if (i == (e.arrayChords.length-1)){
        e.arrayChords[i].ticktime = SEQ.barTotalMillies-e.arrayChords[i].starttime;
      }
      else {
        e.arrayChords[i].ticktime = e.arrayChords[i+1].starttime-e.arrayChords[i].starttime;
      }
    }

  };

	SEQ.addEvent = function(str,info,afterIndex){
		var SEQ = this;
		// Global values
		var glob = zs4.string.split.separators(info,':');
		if (glob.length==2){
			//window.alert(info);
      if (glob[0].trim()=='tpb'){
				this.tpb = parseInt(glob[1]);
				if (this.tpb < MIN_TICKS_PER_BEAT)this.tpb = MIN_TICKS_PER_BEAT;
				else if (this.tpb > MAX_TICKS_PER_BEAT) this.tpb = MAX_TICKS_PER_BEAT;

        if (zs4.is.window())this.bpmTool.eEventTpbInput.value = this.tpb;

			}
      if (glob[0].trim()=='bpb'){
				this.bpb = parseInt(glob[1]);
				if (this.bpb < MIN_BEATS_PER_BAR)this.bpb = MIN_BEATS_PER_BAR;
				else if (this.bpb > MAX_BEATS_PER_BAR) this.bpb = MAX_BEATS_PER_BAR;

        if (zs4.is.window())this.bpmTool.eEventBpcInput.value = this.bpb;

			}
			if (glob[0].trim()=='bpm'){
				SEQ.bpm = parseInt(glob[1]);
				if (SEQ.bpm < MIN_BEATS_PER_MINUTE)SEQ.bpm = MIN_BEATS_PER_MINUTE;
				else if (SEQ.bpm > MAX_BEATS_PER_MINUTE) SEQ.bpm = MAX_BEATS_PER_MINUTE;

				if (zs4.is.window())this.bpmTool.eEventBpmInput.value = this.bpm;
			}

      if (glob[0].trim()=='lf'){
        if (glob[1].trim()=='false'){
          SEQ.layoutlinefeed = false;
          if (zs4.is.window())SEQ.toolobject.layout.eLineFeed.checked=false;
        }
        else {
          SEQ.layoutlinefeed = true;
          if (zs4.is.window())SEQ.toolobject.layout.eLineFeed.checked=true;
        }
      }
		}
		if (info.search(":") != -1) return 0;

		var o = {
			ts:this,
			space:false,
			linefeed:false,
			bar:null,
			beat:null,
			melody:0,
			duration:0,
			lyric:str,
			refresh:function(){},
			hasMusic:function(){
				if (this.bar != null
					|| this.beat != null
					|| this.chord != null
					|| this.melody != 0
				) return true;
				return false;
			},
      isChord:function(){if (this.chord!=null&&this.chord.ok)return true; return false;},
      isBar:function(){return zs4.is.object(this.bar)},
      isBeat:function(){return zs4.is.object(this.beat)},
      isLinefeed:function(){return this.linefeed;},
      isSpace:function(){return this.space;},
      isMelody:function(){if(this.melody!=0)return true;return false;},
      isLyric:function(){if(this.lyric!='')return true;return false;},
      toggleBar:function(){
        if (this.bar){this.bar=null;this.beat=null}
        else {this.bar = {}; this.beat = {};}

      },
      toggleBeat:function(){
        if (this.bar == null){
          if (this.beat){
            this.beat=null;
            this.eBlockChart.title ='';
          }
          else this.beat = {};
        }
      },
		};
    if (zs4.is.node())o.refresh = function(){};

    var EVENT = o;

      // MUSICAL info
    ///////////////////////////////////
		while (true){
			if (info.substr(0,1)=='|'){
				o.bar = {}; o.beat = {};
				info = info.substr(1,info.length-1);
			}
			else if (info.substr(0,1)=='.'){
				o.beat = {};
				info = info.substr(1,info.length-1);
			}
			else break;
		}

		// note
		var note = '';
		while (true){
			var nc = info.charAt(0);
			if (nc >= '0' && nc <= '9'){ note += nc; info = info.substr(1,info.length-1);}
			else break;
		}
		if (note.length > 0) {
			o.melody = parseInt(note);
		}

		var chord = ts.music.parse.chord(info);
		if (chord.ok){
			o.chord = chord;
      if (!this.key.ok) {
				this.key.v  = chord.v;
				this.key.t  = chord.t;
				this.key.ok = chord.ok;
			}
		}

    // TEXT info
    ///////////////////////////////////
    if (str=='\n')o.linefeed = o.space = true;
    if (str==' ')o.space = true;

		if (afterIndex==null){
			afterIndex=this.evt.length;
		}
		else if (zs4.is.number(afterIndex)){
			if (afterIndex<0)afterIndex=0;
			if (afterIndex>this.evt.length)afterIndex=this.evt.length;
		}
		else {
			afterIndex=this.evt.length;
		}
    o.index = afterIndex;

		this.evt.splice(afterIndex,0,o);

    if (zs4.is.window()){
      function putEmptyImage(p,space){
          var w = '0.01em'; if (space==true) w = '0.3em';
          var h = '1em';
          p.innerHTML = '<svg width=\"'+w+'\" height=\"'+h+'\"></svg>';
      }
      function cursor(){
        return '<span style="color:red;font-weight:bolder;">|</span>';
      };
      function black(s,bolder){
        if (bolder)return '<span style="color:black;font-weight:bolder;">'+s+'</span>';
        return '<span style="color:black;">'+s+'</span>';
      };
      function grey(s,bolder){
        if (bolder)return '<span style="color:grey;font-weight:bolder;">'+s+'</span>';
        return '<span style="color:grey;">'+s+'</span>';
      };
      function red(s,bolder){
        if (bolder)return '<span style="color:red;font-weight:bolder;">'+s+'</span>';
        return '<span style="color:red;">'+s+'</span>';
      };
      o.refresh = function(){
        var isPlaying = SEQ.isPlaying();
        o.eSpan.style.paddingTop = '0.5em';
        o.eSpan.style.paddingBottom = '0.5em';
        o.eBlockMelody.style.fontSize = '0.5em';
        o.eBlockMelody.style.color = 'lightgray';

        if (o.isBar()) o.eSpan.style.borderLeft = '0.05em solid grey';
        else {
          o.eSpan.style.borderLeft = 'initial';
          if (o.isBeat()){
            o.eBlockChart.style.borderLeft = '0.05em dotted gray';
          }
          else {
            o.eBlockChart.style.borderLeft = 'initial';
          }
        }

        if (o.current){
          o.eSpan.focus();

          if (!isPlaying && (SEQ.kbm==KBM_BAR)){
            o.eSpan.style.backgroundColor = 'initial';
            o.eBlockMelody.style.borderLeft = '0.3em solid red';
            o.eBlockLyric.style.borderLeft = '0.15em solid red';
          }
          else if (!isPlaying && (SEQ.kbm==KBM_BEAT)){
            o.eSpan.style.backgroundColor = 'initial';
            o.eBlockMelody.style.borderLeft = '0.05em solid red';
            o.eBlockLyric.style.borderLeft = '0.05em solid red';
          }
          else {
            o.eSpan.style.backgroundColor = 'rgba(200,200,200,0.3)';
            o.eBlockMelody.style.borderLeft = 'initial';
            o.eBlockLyric.style.borderLeft = 'initial';
          }

          if (!isPlaying && SEQ.kbm == KBM_LYRIC){
            o.eBlockLyric.style.backgroundColor = 'white';
          }
          else {
            o.eBlockLyric.style.backgroundColor = 'initial';
          }

          if (!isPlaying && SEQ.kbm == KBM_CHORD){
            o.eBlockChart.style.backgroundColor = 'white';
          }
          else {
            o.eBlockChart.style.backgroundColor = 'initial';
          }

          if (!isPlaying && SEQ.kbm == KBM_MELODY){
            o.eBlockMelody.style.backgroundColor = 'white';
          }
          else {
            o.eBlockMelody.style.backgroundColor = 'initial';
          }

        }
        else {
          o.eBlockMelody.style.borderLeft = 'initial';
          o.eBlockLyric.style.borderLeft = 'initial';
          o.eSpan.style.backgroundColor = 'initial';
          o.eBlockLyric.style.backgroundColor = 'initial';
          o.eBlockChart.style.backgroundColor = 'initial';
          o.eBlockMelody.style.backgroundColor = 'initial';
        }

        if (!isPlaying && o.current && SEQ.kbm == KBM_CHORD){
          var left = ''; var right = '';
          if (SEQ.kb.pos=='start'||SEQ.kb.pos<0)SEQ.kb.pos = 0;

          if (this.isChord()){
            SEQ.kb.chord = ts.music.CHORD.toString(this.chord);
            if (SEQ.kb.pos=='end'||SEQ.kb.pos>SEQ.kb.chord.length){
              SEQ.kb.pos=SEQ.kb.chord.length;
            }
            this.eChordBaseNote.innerHTML=
              black(SEQ.kb.chord.substr(0,SEQ.kb.pos),true)+
              cursor()+
              red(SEQ.kb.chord.substr(SEQ.kb.pos,SEQ.kb.chord.length-SEQ.kb.pos),true);
          }
          else {
            function initChord(){
              var pi = SEQ.searchPrevChord(this.index);
              if (!SEQ.evt[pi].isChord())SEQ.kb.chord='C';
              else SEQ.kb.chord = ts.music.CHORD.toString(SEQ.evt[pi].chord);
            };
            if (!zs4.is.string(SEQ.kb.chord)){
              initChord();
            }
            if (SEQ.kb.pos=='end'||SEQ.kb.pos>SEQ.kb.chord.length){
              SEQ.kb.pos=SEQ.kb.chord.length;
            }
            var slash = SEQ.kb.chord.indexOf('/');
            if (slash==-1){
              if (SEQ.kb.pos==1 && SEQ.kb.chord.length==1 && SEQ.abc.modCount!=0){
                var noteobj = SEQ.abc.findNoteObject(SEQ.kb.chord);
                if (noteobj != null){
                  if (noteobj.value == (noteobj.orig+1)){
                    SEQ.kb.chord += '#';
                    SEQ.kb.pos = 2;
                  }
                  if (noteobj.value == (noteobj.orig-1)){
                    SEQ.kb.chord += 'b';
                    SEQ.kb.pos = 2;
                  }
                }
              }

              if ((SEQ.kb.pos<=2) && SEQ.kb.chord.length==SEQ.kb.pos){
                var v = ts.music.parse.note(SEQ.kb.chord);
                if (v != -1 && SEQ.kb.typed==true){
                  var gk = SEQ.guessedKeys;
                  for (var i=0;i<gk.length;i++){
                    if (gk[i].r==v){
                      var r = ts.music.guess.chord.from.scaleObject(gk[i]);
                      SEQ.kb.chord += r[0].t;
                      break;
                    }
                  }
                }
              }
              else if (SEQ.kb.ctb()){
                var ctp = SEQ.kb.ctp();
                SEQ.kb.chord =
                  SEQ.kb.chord.substr(0,ctp)+
                  ts.music.CHORD.suggestType(SEQ.kb.chord.substr(ctp,SEQ.kb.pos-ctp));
                  //console.log(SEQ.kb.chord);
              }

              if (SEQ.kb.pos==0){
                var c = ts.music.parse.chord(SEQ.kb.chord);
                if (!c.ok)initChord();
              }
            }
            else {
              // BASSNOTEREFRESH
              var pre = SEQ.kb.chord.substr(0,slash);
              var pc = ts.music.parse.chord(pre);
              if (pc.ok){
                if (SEQ.kb.chord[SEQ.kb.pos-1]=='/'&&SEQ.kb.typed){
                  //console.log('chord '+SEQ.kb.chord+' needs bass note');
                  var n = ts.music.CHORD.noteFromChordIndex(pc,2)+pc.v;
                  SEQ.kb.chord = SEQ.kb.chord.substr(0,SEQ.kb.pos)+SEQ.abc.findNoteNameReverse(n);
                }
                if (SEQ.kb.chord[SEQ.kb.pos-2]=='/'&&SEQ.kb.pos==SEQ.kb.chord.length){
                  var noteobj = SEQ.abc.findNoteObject(SEQ.kb.chord.substr(SEQ.kb.pos-1,1));
                  //console.log('bass note entered');
                  if (noteobj != null){
                    var note = zs4.string.to.upper(noteobj.name);
                    var sub = SEQ.kb.chord.substr(0,SEQ.kb.pos-1);
                    if (noteobj.value == (noteobj.orig+1)){
                      SEQ.kb.chord = sub+note+'#';
                    }
                    else if (noteobj.value == (noteobj.orig-1)){
                      SEQ.kb.chord = sub+note+'b';
                    }
                    else {
                      SEQ.kb.chord = sub+note;
                    }
                  }
                }
              }

            }

            SEQ.kb.typed = false;
            this.eChordBaseNote.innerHTML=
              grey(SEQ.kb.chord.substr(0,SEQ.kb.pos))+
              cursor()+
              red(SEQ.kb.chord.substr(SEQ.kb.pos,SEQ.kb.chord.length-SEQ.kb.pos));
          }
        }
        else {
          if (this.isChord()){
            this.eChordBaseNote.innerHTML = ts.music.CHORD.toString(this.chord)
          }
          else{
            putEmptyImage(this.eChordBaseNote,true);
          }
        }


        if (!isPlaying && o.current && SEQ.kbm == KBM_MELODY)
        {
          o.eBlockMelody.style.backgroundColor = 'red';
        }
        else {
          o.eBlockMelody.style.backgroundColor = 'initial';
        }

        if (this.melody < ts.midi.constant.MIDI_NOTE_MIN || this.melody > ts.midi.constant.MIDI_NOTE_MAX ){
          putEmptyImage(this.eBlockMelody,true);
          //this.eBlockMelody.style.visibility = 'hidden';
        }else{
          this.eBlockMelody.textContent = ts.music.note.qualified(o.melody);
        }

        if (!isPlaying && o.current && SEQ.kbm == KBM_LYRIC){
            if (SEQ.kb.pos=='start'){
              this.eBlockLyric.innerHTML = cursor()+this.lyric;
              SEQ.kb.pos = 0;
            }
            else if (SEQ.kb.pos=='end'){
              this.eBlockLyric.innerHTML = this.lyric+cursor();
              SEQ.kb.pos = this.lyric.length;
            }
            else {
              if (!zs4.is.number(SEQ.kb.pos))SEQ.kb.pos=0;
              else if (SEQ.kb.pos<0)SEQ.kb.pos=0;
              else if (SEQ.kb.pos>this.lyric.length)SEQ.kb.pos=this.lyric.length;

              this.eBlockLyric.innerHTML =
                this.lyric.substr(0,SEQ.kb.pos)+
                cursor()+
                this.lyric.substr(SEQ.kb.pos,this.lyric.length-SEQ.kb.pos);
            }
        }
        else {
          if (this.lyric==' ')this.space = true;
          else if (this.lyric=='\n')this.space=this.linefeed=true;
          else this.space=this.linefeed=false;

          if (this.isSpace()){
            putEmptyImage(this.eBlockLyric,true);
          }
          else if (this.lyric != ''){
            if (this.isSpace())putEmptyImage(this.eBlockLyric,true);
            else this.eBlockLyric.textContent = this.lyric;
          }
          else {
            putEmptyImage(this.eBlockLyric,true);
          }

          if (this.isLinefeed()&&SEQ.layoutlinefeed){
            this.eLineFeed.style.display = 'initial';
          }
          else {
            this.eLineFeed.style.display = 'none';
          }

        }

      };

      // create all neccessary elementSave
      if (true){
        o.eEvent = document.createElement('ts-event-span');
  			o.eEvent.ts = o;
  			o.eEvent.onclick = function(){
          if (SEQ.kbm==KBM_CHORD){
            SEQ.kb.chord = null;
          }
          this.ts.ts.onEventClick(this.ts);
          if (SEQ.kbm==KBM_CHORD){
            SEQ.kb.chord = null;
            SEQ.kb.pos = -1;
            o.refresh();
          }
        };

  			o.eSpan = document.createElement('ts-event');
  			o.eSpan.style.display = 'inline-block';
  			o.eSpan.ts = o;
  			o.eEvent.appendChild(o.eSpan);

  			o.eBlockMelody = document.createElement('ts-block-melody');
        o.eBlockMelody.style.height = '1em';
        o.eBlockMelody.style.minHeight = '1em';
  			o.eBlockMelody.style.display = 'block';
  			o.eSpan.appendChild(o.eBlockMelody);

  			o.eBlockChart = document.createElement('ts-block-chart');
  			o.eBlockChart.style.display = 'block';
  			o.eBlockChart.style.height = '1em';
        o.eBlockChart.style.minHeight = '1em';
  			o.eSpan.appendChild(o.eBlockChart);

  				o.eChordBaseNote = document.createElement('ts-chord-base');
  				o.eBlockChart.appendChild(o.eChordBaseNote);

  			o.eBlockLyric = document.createElement('ts-block-lyric');
  			o.eBlockLyric.style.display = 'block';
  			o.eBlockLyric.style.height = '1em';
        o.eBlockLyric.style.minHeight = '1em';
  			o.eBlockLyric.ondblclick = function(e){
  				SEQ.onEventClick(EVENT);
  				if (SEQ.evt[SEQ.evt_curidx]!=EVENT)return;

  				var clickpos = parseInt(this.textContent.length * e.offsetX / this.offsetWidth);

  				var old = ''; var nu = ''; var orig = this.textContent;
  				for (var i = 0 ; i < orig.length; i++){
  					if (i < clickpos) old+=orig.charAt(i);
  					else nu+=orig.charAt(i);
  				}
  				//zs4.debug(old+'-'+nu);
  				EVENT.lyric = EVENT.eBlockLyric.textContent = old;
  				var nuEvent = SEQ.addEvent(nu,'',(SEQ.evt_curidx+1));
  				SEQ.onEventClick(nuEvent);
  				//zs4.debug(nuEvent);
  				SEQ.alignHTML();
  				//zs4.debug(zs4.json.textify(e));
  			};

  			o.eSpan.appendChild(o.eBlockLyric);

        o.eLineFeed = document.createElement('br');
        o.eEvent.appendChild(o.eLineFeed);

  			this.cnt.appendChild(o.eEvent);
      }

      o.refresh();
    }

    SEQ.setCurrentEvent(o);
		return o;
	};
	SEQ.run = function(){
		this.runChordsAndLyrics();
		this.transpose(0);
		if (this.evt.length > 0)
			this.setCurrentEvent(this.evt[0]);
	};
	SEQ.clear = function(){
		this.evt = new Array();
		this.evt_current = null;
		this.evt_curidx = this.evt.length-1;
    this.kb.pos = 'start';
    this.kbm = KBM_EVENT;
		if (zs4.is.window())this.cnt.innerHTML = '';
	};
	SEQ.runChordsAndLyrics = function(data){
		SEQ.data = data;
		if (SEQ.data == null || SEQ.data.length < 1){
      if (zs4.is.window()){
        this.toolobject.script.use();
				return SEQ.cnt;
      }
      return '';
		}

		//var process='p';
		var buffer = "";
		var musinfo = "";

		var cur = 0;
		var last_ch = ' ';
    var last_ch_was_space = true;
    var last_ch_was_linefeed = 1;
		for (var i = 0 ; i < this.data.length ; i++){
			var render = false;
			var cur_ch = this.data.charAt(i);

      // handle line breaks;
			if (cur_ch == '\n'){
        if (last_ch_was_linefeed > 1)continue;
				if (this.evt.length == 0){
					continue;
				}
				if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}
				this.addEvent('\n',musinfo);
        last_ch_was_space = true;
        last_ch_was_linefeed += 1;
				continue;
			}
      else {
        last_ch_was_linefeed = 0;
      }

      // handle spaces;
			if (zs4.is.space(cur_ch)){
        if (last_ch_was_space)continue;
        if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}
				if (this.evt.length == 0){
					continue;
				}
				//if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}
				this.addEvent(' ','');
        last_ch_was_space = true;
				continue;
			}
      else {
        last_ch_was_space = false;
      }

			// handle musical info
			if (cur_ch == '['){
				if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}
				last_ch_was_space = false;
				if (i < (this.data.length-1)) i++; else break;
				var from = i;
				var count = 0;
				var found = false;
				for (;i<this.data.length;i++){
					if (this.data.charAt(i) == ']'){found = true;break;}
					count++;
				}
				if (!found){
					var ne = document.createElement("ts-error");
					ne.textContent = "unmatched [ character!";
					this.cnt.appendChild(ne);
					break;
				}
				musinfo = this.data.substr(from,count);

				continue;
			}

      buffer += cur_ch.toString();
		}

    // FLUSH BUFFERS AFTER LOOP
		if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}

		if (zs4.is.window()) this.cnt.appendChild(document.createElement("br"));
		//this.onSelectTool('chord');

    var text = '';
    for (var i = 0 ; i < SEQ.evt.length;i++)text+=SEQ.evt[i].lyric;
    //console.log(text);
    //console.log(SEQ.getChordsAndLyrics());

		this.setCurrentEvent(this.evt[0]);
		if (zs4.is.window())this.refresh();
		//this.renderStats();

		return this.cnt;
	};
	SEQ.getChordsAndLyrics = function(){
		var ret = '[bpb:'+this.bpb+'][bpm:'+this.bpm+'][tpb:'+this.tpb+']';

		if (SEQ.layoutlinefeed){
			ret+='[lf:true]';
		}
		else {
			ret+='[lf:false]';
		}

		for (var i = 0; i < this.evt.length; i++){
			var evt = this.evt[i];
			if (evt.hasMusic()){
				ret+='[';

				// bar / beat
				if (evt.bar != null)ret+='|';
				else if (evt.beat!=null)ret+='.';

				if (evt.melody >= ts.midi.constant.MIDI_NOTE_MIN && evt.melody <= ts.midi.constant.MIDI_NOTE_MAX){
					ret+=evt.melody;
				}
				// chord\
				if (evt.chord != null){
					ret+=ts.music.note.name(evt.chord.v);
					ret+=ts.music.CHORD.TYPE[evt.chord.t].t;
					if (evt.chord.v != evt.chord.b)ret+= '/'+ ts.music.note.name(evt.chord.b);
					evt.chord.v;
				}
				ret+=']';
			}

			if (evt.linefeed==true) {
        ret += '\n';
      }
			if (evt.space==true){
        ret += ' ';
      }
			else ret += evt.lyric.trim();
		}

		return ret;
	};

  SEQ.runABC = function(input,idx){
    const DOT_MULTIPLIER = 1.5;
    var index = new Array();
    var ABC = new ts.abc();

    if (!zs4.is.string(input)||input=='') return;

    // extract lines
    ABC.parse(input);

    var toonsmith = ABC.toToonsmith();

    zs4.debug(ABC);
    zs4.debug(toonsmith);

    return toonsmith;
  };

  SEQ.refresh = function(){
    this.updateStats();
    this.recomputeTiming();
  };
};

ts.abc = function(){
  var ABC = this;
  ABC.X = '',
  ABC.L_DIVIDEND = 1;
  ABC.L_DIVISOR = 8;
  ABC.M_DIVIDEND = 4;
  ABC.M_DIVISOR = 4;
  ABC.bar = new Array();
  ABC.line = new Array();
  ABC.failures = new Array();
  ABC.currentBar = null;
  ABC.verseCount = 0;
  ABC.lastMusicLineStart = null;
  ABC.lastMusicLineEnd = null;
  ABC.mode = 'header';
  ABC.modCount = 0;
  ABC.modType = '';
  ABC.NOTE = ['A','B','C','D','E','F','G','a','b','c','d','e','f','g'];
  ABC.KEY = {
    G:{c:1,t:1,o:7},
    D:{c:2,t:1,o:2},
    A:{c:3,t:1,o:9},
    E:{c:4,t:1,o:4},
    B:{c:5,t:1,o:11},
    'F#':{c:6,t:1,o:6},
    'C#':{c:7,t:1,o:1},

    F:{c:1,t:-1,o:5},
    'Bb':{c:2,t:-1,o:10},
    'Eb':{c:3,t:-1,o:3},
    'Ab':{c:4,t:-1,o:8},
    'Db':{c:5,t:-1,o:1},
    'Gb':{c:6,t:-1,o:6},
    'Cb':{c:7,t:-1,o:11},
  };
  ABC.failure = function(txt){
    ABC.failures.push(txt);
    zs4.debug('ABC failure: \"'+txt+'\"');
    return false;
  };
  ABC.barCreate = function(){
    var BAR = new Object({
      content:new Array(),
      lyrix:new Array(),
      raw:'',
    });
    BAR.index = this.bar.length;
    BAR.lf = false;
    this.bar.push(BAR);
    this.currentBar = BAR;
    return BAR;
  };
  ABC.firstBarIsComplete = function(){
    if (ABC.bar.length==0)return false;
    var time = 0;
    var a = ABC.bar[0].content;
    for (var i = 0; i < a.length; i++)time += a[i].length;
    if (time >= ((1 * ABC.M_DIVIDEND)/ABC.M_DIVISOR))return true;
    return false;
  };
  ABC.hasLyrix = function(){
    var ret = false;
    for (var i = 0; i < ABC.bar.length; i++){
      if (ABC.bar[i].lyrix.length > ABC.verseCount){
        ABC.verseCount = ABC.bar[i].lyrix.length;
        ret = true;
      }
    }
    return ret;
  };
  ABC.noteTableCreate = function(K){
    var BOTTOM = 48;
    var TABLE = ABC.note = new Array();
    function note(n,v){
      var NOTE = this;
      NOTE.name = n;
      NOTE.value = v;
      NOTE.orig = v;
    };

    if (true){
      ABC.note.push(new note('C,',BOTTOM));
      ABC.note.push(new note('D,',BOTTOM+2));
      ABC.note.push(new note('E,',BOTTOM+4));
      ABC.note.push(new note('F,',BOTTOM+5));
      ABC.note.push(new note('G,',BOTTOM+7));
      ABC.note.push(new note('A,',BOTTOM+9));
      ABC.note.push(new note('B,',BOTTOM+11));

      ABC.note.push(new note('C',BOTTOM+12));
      ABC.note.push(new note('D',BOTTOM+12+2));
      ABC.note.push(new note('E',BOTTOM+12+4));
      ABC.note.push(new note('F',BOTTOM+12+5));
      ABC.note.push(new note('G',BOTTOM+12+7));
      ABC.note.push(new note('A',BOTTOM+12+9));
      ABC.note.push(new note('B',BOTTOM+12+11));

      ABC.note.push(new note('c',BOTTOM+24));
      ABC.note.push(new note('d',BOTTOM+24+2));
      ABC.note.push(new note('e',BOTTOM+24+4));
      ABC.note.push(new note('f',BOTTOM+24+5));
      ABC.note.push(new note('g',BOTTOM+24+7));
      ABC.note.push(new note('a',BOTTOM+24+9));
      ABC.note.push(new note('b',BOTTOM+24+11));

      ABC.note.push(new note('c\'',BOTTOM+36));
      ABC.note.push(new note('d\'',BOTTOM+36+2));
      ABC.note.push(new note('e\'',BOTTOM+36+4));
      ABC.note.push(new note('f\'',BOTTOM+36+5));
      ABC.note.push(new note('g\'',BOTTOM+36+7));
      ABC.note.push(new note('a\'',BOTTOM+36+9));
      ABC.note.push(new note('b\'',BOTTOM+36+11));
    }

    var keynote = 24;
    ABC.modCount = 0;
    ABC.modType = '';

    var i = 0;
    var Knote = '';
    var Ktype = '';
    //skip leading spaces
    while (i < K.length && K.charAt(i)==' ')i++;
    // handle keynote;
    if (i >= K.length)return ABC.failure('No key note specified');
    if (ABC.isNoteCharacter(K.charAt(i))){Knote+=K.charAt(i);i++}
    else {return ABC.failure(K.charAt(i)+' is not a valid key note');}
    if (i<K.length&&(K.charAt(i)=='#'||K.charAt(i)=='b')){Knote+=K.charAt(i);i++}
    //skip spaces
    while (i < K.length && K.charAt(i)==' ')i++;
    while (i < K.length && K.charAt(i)!=' '){Ktype+=K.charAt(i);i++;}
    // done parsing key
    zs4.debug('key note: '+Knote, 'Ktype: '+Ktype);
    keynote = ts.music.parse.note(Knote);
    if (keynote==-1)return ABC.failure(Knote+' is not a valid keynote');
    if (Ktype=='m'||Ktype=='min'||Ktype=='minor')keynote+=3;
    else if (zs4.string.startsWith(Ktype,'dor'))keynote-=2;
    else if (zs4.string.startsWith(Ktype,'phr'))keynote-=4;
    else if (zs4.string.startsWith(Ktype,'lyd'))keynote-=5;
    else if (zs4.string.startsWith(Ktype,'mix'))keynote-=7;
    else if (zs4.string.startsWith(Ktype,'aeo'))keynote-=9;
    else if (zs4.string.startsWith(Ktype,'loc'))keynote-=11;

    keynote %= 12;

    if (keynote==0){
      zs4.debug('using no B\'s or #\'s');
      return true;
    }

    var DO = -1;
    for(var n in ABC.KEY){
      if (ABC.KEY[n].o==keynote){
        DO = ABC.KEY[n];
        break;
      }
    }
    if (DO==-1){
      return ABC.failure('internal error during key lookup')
    }

    //var t = new Array();
    var start; var increment; var count; var symbol;
    ABC.modCount = count = DO.c;

    if (DO.t==1){
      start = 5;
      increment = 7;
      ABC.modType = symbol = '#';
      zs4.debug('using '+count+' #\'s');
    }
    else if (DO.t==-1){
      start = 11;
      increment = 5;
      ABC.modType = symbol = 'b';
      zs4.debug('using '+count+' b\'s');
    }

    for (var i = 0 ; i < TABLE.length; i++){
      var pos = start;
      for (var c = 0; c < count; c++ ){
        if ((TABLE[i].orig%12)==pos){
          TABLE[i].value += DO.t;
          zs4.debug(TABLE[i].name+symbol);
          break;
        }
        pos = ((pos+increment)%12);
      }
    }

    return true;
  };
  ABC.isNoteCharacter = function(ch){
    for (var x = 0; x < ABC.NOTE.length;x++){
      if (ABC.NOTE[x]==ch)return true;
    }
    return false;
  };
  ABC.findNoteValue = function(n){
    for (var i = 0 ; i < this.note.length;i++){
      if (this.note[i].name==n)return this.note[i].value.toString();
    }
    return '';
  };
  ABC.findNoteObject = function(n){
    for (var i = 0 ; i < this.note.length;i++){
      if (this.note[i].name==n)return this.note[i];
    }
    return null;
  };
  ABC.findNoteNameReverse = function(v){
    v%=12;
    for (var i = 7 ; i < 14;i++){
      if ((this.note[i].value%12)==(v%12)){
        if (this.note[i].value==this.note[i].orig){
          return this.note[i].name;
        }
        if (ABC.modType=='#'&&this.note[i].value==(this.note[i].orig+1)){
          return this.note[i].name+'#';
        }
        else if (ABC.modType=='b'&&this.note[i].value==(this.note[i].orig-1)){
          return this.note[i].name+'b';
        }
      }
    }

    if (ABC.modType=='b'){
      for (var i = 7 ; i < 14;i++){
        if (((this.note[i].orig)%12)==(v%12)){
          return this.note[i].name;
        }
        if (((this.note[i].orig-1)%12)==(v%12)){
          return this.note[i].name + 'b';
        }
      }
    }

    if (ABC.modType=='#'){
      for (var i = 7 ; i < 14;i++){
        if (((this.note[i].orig)%12)==(v%12)){
          return this.note[i].name;
        }
        if (((this.note[i].orig+1)%12)==(v%12)){
          return this.note[i].name + '#';
        }
      }
    }

    if (v==0)return 'C';
    if (v==1)return 'C#';
    if (v==2)return 'D';
    if (v==3)return 'Eb';
    if (v==4)return 'E';
    if (v==5)return 'F';
    if (v==6)return 'F#';
    if (v==7)return 'G';
    if (v==8)return 'Ab';
    if (v==9)return 'A';
    if (v==10)return 'Bb';
    if (v==11)return 'B';
  };
  ABC.addNote = function(n,t,x){
    this.currentBar.content.push(new Object({
      note:n,
      length:t,
      beat:0,
      lab:0,
      x:x,
    }));
  };
  ABC.parseLyricLine = function(line){
    line = line.substr(2,line.length-2).trim();

    var word = ''; // -_*
    var ret = new Array();
    function addWord(space){
      if (word != '')ret.push(word);
      word = '';
      if (space==' '||space=='-'){
        ret.push(space);
      }
    }

    for (var i = 0; i < line.length;i++){
      if (line.charAt(i)==' '){
        addWord(' ');
      }
      else if (line.charAt(i)=='-'){
        addWord('-');
      }
      else if (line.charAt(i)=='_'){
        addWord(); word = '*'; addWord();
      }
      else if (line.charAt(i)=='*'){
        addWord(); word = '*'; addWord();
      }
      else {
        word += line.charAt(i);
      }
    }
    addWord();
    return ret;
  };
  ABC.toToonsmith = function(){
    var BAR = (1 * ABC.M_DIVIDEND)/ABC.M_DIVISOR;
    var BEAT = 1/ABC.L_DIVISOR;
    var out = '[bpb:'+ABC.M_DIVIDEND+']';



    function outPass(v){
      var fbc = true;
      if (!ABC.firstBarIsComplete()){
        zs4.debug('FIRST BAR IS INCOMPLETE!');
        fbc = false;
      }

      var LYRIX = null;
      var lyri = 0;
      for (var i=0; i < ABC.bar.length;i++){
        var bar = ABC.bar[i].content;
        if (zs4.is.number(v)&&ABC.bar[i].lyrix.length>0){
          if (v<ABC.bar[i].lyrix.length){
            LYRIX = ABC.parseLyricLine(ABC.bar[i].lyrix[v]);
          }
          else {
            LYRIX = ABC.parseLyricLine(ABC.bar[i].lyrix[0]);
          }
          zs4.debug(LYRIX);
          lyri = 0;
        }

        if (ABC.bar[i].lf)out+='\n';
        if (bar.length==0){
          out+='[|]\n';
        }
        else {
          var time = 0;
          var beat = 0;
          var space = false;
          for (var n = 0; n < bar.length;n++){
            out += '[';
            if (n==0) {
              if (i==0 && !fbc)out+='.'
              else out+='|';

              bar[n].beat=beat;
              beat+=1;
            }
            else if ((beat*BEAT)<=time){
              out+='.';
              bar[n].lab = time-(beat*BEAT);
              if (bar[n].lab>0.00001)out+='][';

              bar[n].beat=beat;
              beat+=1;
            }
            else {
              bar[n].lab = time-(beat*BEAT);
              bar[n].beat=beat;
            }
            out += ABC.findNoteValue(bar[n].note);
            if (bar[n].x!=null&&bar[n].x.chord!=null){
              out += ts.music.CHORD.toString(bar[n].x.chord);
            }
            out +=']';
            if (LYRIX!=null&&lyri<(LYRIX.length)){
              if (LYRIX[lyri]!='*'&&LYRIX[lyri]!='_')out+=LYRIX[lyri];
              lyri++;
              if (lyri<(LYRIX.length)&&(LYRIX[lyri]==' '||LYRIX[lyri]=='-')){
                out+=LYRIX[lyri];lyri++;
                while (lyri<(LYRIX.length)&&LYRIX[lyri]==' '){
                  lyri++;
                }
              }
            }
            time += bar[n].length;
            while (((beat+1)*BEAT)<=time){
              out += '[.]';
              beat+=1;
            }
          }
        }
      }
    };

    // this
    if (ABC.hasLyrix()){
      zs4.debug('ABC HAS LYRIX IT!! verseCount='+ABC.verseCount);
      for (var i = 0; i < ABC.verseCount; i++){
        outPass(i)
      }
    }
    else {
      outPass(null);
    }

    return out;
  };
  ABC.parseHeaderLine = function(line){
    var head = zs4.string.split.separators(line,':');
    if (head.length==2){
      if (head[0]=='X'){
        //if (ABC.X != '')break;
        ABC.X = head[1];
        line = '';
      }
      else if (head[0]=='T'){
        ABC.T = head[1];
        line = '';
      }
      else if (head[0]=='C'){
        ABC.C = head[1];
        line = '';
      }
      else if (head[0]=='M'){
        var m = zs4.string.split.separators(head[1],'/');
        if (m.length==2){
          ABC.M_DIVIDEND = zs4.parse.int(m[0]);
          ABC.M_DIVISOR = zs4.parse.int(m[1]);
        }
        line = '';
      }
      else if (head[0]=='L'){
        var m = zs4.string.split.separators(head[1],'/');
        if (m.length==2){
          ABC.L_DIVIDEND = zs4.parse.int(m[0]);
          ABC.L_DIVISOR = zs4.parse.int(m[1]);
        }
        line = '';
      }
      else if (head[0]=='K'){
        ABC.K = head[1];
        line = '';
        ABC.noteTableCreate(ABC.K);
        ABC.barCreate();
        ABC.mode = 'content';
      }
    }
  };
  ABC.pass1 = function(input){
    var line = '';
    for (var i = 0; i < input.length;i++){
      var ch = input.charAt(i);
      if (ABC.mode == 'header') {
        if (ch=='\n'){
          ABC.parseHeaderLine(line);
          line = '';
        }
        else {
          line += ch;
        }
      }
      else {
        var ch = input.charAt(i);
        if (ch=='\n'){
          if (line=='')continue;
          else {
            ABC.line.push({data:line.trim()});
            line = '';
          }
        }
        else {
          line += ch;
        }
      }
    }
    if (line!=''){
      ABC.line.push({data:line});
    }
  };
  ABC.parseLineMusic = function(input){
    var gch = null;
    var acc = '';
    function extra(){
      var e = new Object({
        chord:gch,
        acc:acc,
      })
      gch = null;
      acc = '';
      return e;
    };

    var glt_ratio = 1;
    function ratio(glt){
      const GT = 1.5;
      const LT = 0.5;
      if (glt=='>'){
        glt_ratio = LT;
        return GT;
      }
      else if (glt=='<'){
        glt_ratio = GT;
        return LT;
      }
      var r = glt_ratio;
      glt_ratio = 1;
      return r;
    };

    for (var i = 0; i < input.length;i++){
      var ch = input.charAt(i);
      if (ch==' '||ch=='~'||ch=='\n')continue;

      // bar break
      if (ch==':'||ch=='|'||ch==']'){
        var bc = [':','|',']','['];
        function check(ch){for (var x = 0; x < bc.length;x++){if (bc[x]==ch)return true;}return false;};
        while ((i < (input.length-1))&&(check(input[i+1])))i++;

        if ((i < (input.length-1)&&zs4.is.numchar(input[i+1]))) {
          i++;
          if (input[i]=='1'){
            while ((i < (input.length-1))&&(!check(input[i+1])))i++;
            while ((i < (input.length-1))&&(check(input[i+1])))i++;
          }
        }

        ABC.barCreate();
      }
      else if (ch=='L'){
        var buf = '';
        while (i < (input.length-1)&&input[i+1]==':')i++;
        while (i < (input.length-1)&&input[i+1]>='0'&&input[i+1]<='9'){
          i++;
          buf+=input[i];
        }
        ABC.L_DIVIDEND = zs4.parse.int(buf);buf='';
        while (i < (input.length-1)&&input[i+1]=='/')i++;
        while (i < (input.length-1)&&input[i+1]>='0'&&input[i+1]<='9'){
          i++;
          buf+=input[i];
        }
        ABC.L_DIVISOR = zs4.parse.int(buf);buf='';
      }
      else {
        if (ABC.isNoteCharacter(ch)||ch=='z'||ch=='Z'){
          var note = ch;
          while ((i < (input.length-1))&&(input[i+1]==','||input[i+1]=='\'')){
            i++;
            note += input[i];
          }

          var length = ABC.L_DIVIDEND/ABC.L_DIVISOR;
          //var num = 1;
          if ((i < (input.length-1)&&input[i+1]=='>')){
            i++;
            length *= ratio('>');
          }
          else if ((i < (input.length-1)&&input[i+1]=='<')){
            i++;
            length *= ratio('<');
          }
          else {
            length *= ratio();
          }

          if ((i < (input.length-1))&&input[i+1]=='/'){
            i++;
            var buf = '';
            while (i < (input.length-1)&&zs4.is.numchar(input[i+1])){
              i++; buf+=input[i];
            }
            if (buf=='')buf='2';
            var num = zs4.parse.int(buf);
            if (num!=0)length /= num;
            else length /= 2;
          }
          else if (i < (input.length-1)&&zs4.is.numchar(input[i+1])){
            var buf = '';
            while (i < (input.length-1)&&input[i+1]>='0'&&input[i+1]<='9'){
              i++; buf+=input[i];
            }
            var num = zs4.parse.int(buf);
            if (num!=0)length *= num;
          }

          ABC.addNote(note,length,extra());
        }
        else if (ch=='"'){
          var chord = ''; gch = null;
          while ((i < (input.length-1))&&input[i+1]!='"'){
            i++;
            chord += input[i];
          }
          i++;
          gch = ts.music.parse.chord(chord);
          if (!gch.ok){
            ABC.failure('Can\'t parse chord \"'+chord+'\"');
          }
        }
        else if (ch=='_'||ch=='^'){
          acc+=ch;
        }
      }
    }

    if (ABC.bar.length > 0)ABC.bar[ABC.bar.length-1].lf = true;
  };
  ABC.parse = function(input){
    ABC.pass1(input);
    for (var i = 0; i < ABC.line.length; i++){
      if (ABC.line[i].data.length>2&&ABC.line[i].data.charAt(1)==':'){
        if (ABC.lastMusicLineStart&&zs4.string.startsWith(ABC.line[i].data,'w')){
          zs4.debug('should add lyrix');
          ABC.lastMusicLineStart.lyrix.push(ABC.line[i].data);
          ABC.lastMusicLineStart.lyrixEnd = ABC.lastMusicLineEnd;
        }
        else {
          ABC.parseHeaderLine(ABC.line[i].data);
        }
      }
      else {
        var mline = false;
        if (ABC.currentBar.content.length==0){
          ABC.lastMusicLineStart = ABC.currentBar;
          mline = true;
        }
        ABC.parseLineMusic(ABC.line[i].data);
        if (mline)ABC.lastMusicLineEnd = ABC.currentBar;
      }
    }

    //remove last bar if EMPTY!
    if (ABC.bar[ABC.bar.length-1].content.length==0){ABC.bar.pop();}
  };
};

ts.music = new Object({
	transpose:{
		note:{
			name:function(value,delta){
				return ((1200+value+delta) % 12);
			}
		},
	},
	parse:{
		chord:function(str){
			str = str.trim();

      //zs4.debug('chord:'+str);

			var nu = {v:0,t:0,b:0,ok:false};


			str = str.trim();
			if (str.length < 1){return nu;};

      var n = ts.music.parse.note(zs4.string.to.upper(str.charAt(0)));
      if (n==-1)return nu;
      nu.v = nu.b = n;
      str = str.substr(1,(str.length-1));
      if (str.length==0){nu.ok=true;return nu;}

			//check for sharp or flat
			if (str[0]=='#'){
				nu.v = nu.b = ts.music.transpose.note.name(nu.v,+1);
				str = str.substr(1,(str.length-1));
			}
			else if (str[0]=='b'){
				nu.v = nu.b = ts.music.transpose.note.name(nu.v,-1);
				str = str.substr(1,(str.length-1));
			}
      if (str.length==0){nu.ok=true;return nu;}

      var type = '';
      for (var t = 0 ; (t < str.length) && (str.charAt(t)!='/') ;t++){
        type += str.charAt(t);
      }
      str = str.substr(type.length,(str.length-type.length));

      var T = ts.music.CHORD.TYPE; var tok = false;
      for (var i = 0 ; (i < T.length)&&(tok==false);i++){
        if (T[i].t==type){nu.t=i;tok=true;break;}
        for (var x = 0; x < T[i].n.length;x++){
          if (T[i].n[x]==type){nu.t=i;tok=true;break;}
        }
      }
      if (tok==false)return nu;
      if (str.length==0){nu.ok=true;return nu;}

			// Slash
			if (str[0] != '/')return nu;
			str = str.substr(1,(str.length-1));
      if (str.length==0){nu.ok=true;return nu;}

      // bass note
      var n = ts.music.parse.note(zs4.string.to.upper(str.charAt(0)));
      if (n==-1)return nu;
      nu.b = n;
      str = str.substr(1,(str.length-1));
      if (str.length==0){nu.ok=true;return nu;}

		  //check for sharp or flat
			if (str[0]=='#'){
				nu.b = ts.music.transpose.note.name(nu.b,+1);
				str = str.substr(1,(str.length-1));
			}
			else if (str[0]=='b'){
				nu.b = ts.music.transpose.note.name(nu.b,-1);
				str = str.substr(1,(str.length-1));
			}
      nu.ok = true;
			return nu;
		},
    note:function(str){
      var a = ts.music.NOTES;
      var s = str.trim();
      for (var i = 0; i < a.length; i++){
        if (a[i].n==s)return a[i].v;
        for (var x = 0; x<a[i].a.length;x++){
          if (a[i].a[x]==s)return a[i].v;
        }
      }
      return -1;
    },
	},
	note:{
		name:function(v){
			v = ts.music.transpose.note.name(v,0);
			return ts.music.NOTES[v].n;
		},
		symbol:function(v){
			v = ts.music.transpose.note.name(v,0);
			return ts.music.NOTES[v].s;
		},
		qualified:function(v){
			return this.name(v) + ((parseInt((v-12)/12)));
		},
	},
  guess:{
    key:{
      from:{
        noteStats:function(stats){
          var a = new Array();
          var st = ts.music.SCALE.TYPE;
          for (var r = 0;r < 12;r++){
            for (var s=0;s < st.length;s++){
              var o = new ts.music.SCALE.object(r,s);
              o.mc = o.mmc = 0;

              var sta = st[s].a;
              for (var n = 0; n < sta.length; n++){
                var note = (((n+r)%12))
                if (sta[n]==true){
                  o.mc+=stats[note];
                }
                else {
                  o.mmc+=stats[note];
                }
              }
              a.push(o);
            }
          }
          a.sort(function(a,b){return b.mc-a.mc})

          //console.log(a);
          return a;
        },
      },
    },
    chord:{
      from:{
        scaleObject:function(so){
          var T = ts.music.CHORD.TYPE;
          var sa = so.s.a; var sacount=0;
          for (var i=0;i<sa.length;i++)if(sa[i]==true)sacount++;
          var ret = new Array();
          for (var i = 0 ; i < T.length;i++){
            var a = T[i].a; var ok = true; var count = 0;
            for (var x = 0 ; x < T[i].a.length;x++){
              if (a[x]==true){
                if(sa[x%sa.length]==false){ok=false;break;}
                count++;
              }
            }
            if (!ok)continue;
            ret.push(new Object({
              n:so.n,
              t:T[i].t,
              mc:count,
            }));
          }
          ret.sort(function(a,b){return b.mc-a.mc});
          return ret;
        },
      },
    },
  },
	PLAIN_NOTES:[
		{n:'C',v:0},
		{n:'D',v:2},
		{n:'E',v:4},
		{n:'F',v:5},
		{n:'G',v:7},
		{n:'A',v:9},
		{n:'B',v:11},
		{n:'H',v:11},
	],
	NOTES:[
		{n:'C',s:'C',v:0,a:['C','c','B#','b#']},
		{n:'C#',s:'C&#x266f;',v:1,a:['C#','c#','Db','db']},
		{n:'D',s:'D',v:2,a:['D','d']},
		{n:'Eb',s:'E&#x266d;',v:3,a:['Eb','eb','D#','d#']},
		{n:'E',s:'E',v:4,a:['E','e','Fb','fb']},
		{n:'F',s:'F',v:5,a:['F','f','E#','e#']},
		{n:'F#',s:'F&#x266f;',v:6,a:['F#','f#','Gb','gb']},
		{n:'G',s:'G',v:7,a:['F','g']},
		{n:'Ab',s:'A&#x266d;',v:8,a:['Ab','ab','G#','f#']},
		{n:'A',s:'A',v:9,a:['A','a']},
		{n:'Bb',s:'B&#x266d;',v:10,a:['Bb','bb','A#','a#']},
		{n:'B',s:'B',v:11,a:['B','b','Cb','cb']},
	],
  SCALE:{
    object:function(r,t){
      this.r=r;
      this.n = ts.music.note.name(r);
      this.s = ts.music.SCALE.TYPE[t];
    },
    find:{
      by:{
        name:function(n){
          var a = ts.music.SCALE.TYPE;
          for (var i = 0; i < a.length;i++){
            if (zs4.string.startsWith(a[i].t,n))return i;
            for (var x=0;x<a[i].n.length;x++){
              if (zs4.string.startsWith(a[i].n[x],n))return i;
            }
          }
          return 0;
        }
      },
    },
    TYPE:[
      {
        t:'major',
        n:['ionian'],
        s:'',
        a:[true,false,true,false,true,true,false,true,false,true,false,true,],
      },
      {
        t:'dorian',
        n:[],
        s:'',
        a:[true,false,true,true,false,true,false,true,false,true,true,false,],
      },
      {
        t:'phrygian',
        n:[],
        s:'',
        a:[true,true,false,true,false,true,false,true,true,false,true,false,],
      },
      {
        t:'lydian',
        n:[],
        s:'',
        a:[true,false,true,false,true,false,true,true,false,true,false,true,],
      },
      {
        t:'mixolydian',
        n:[],
        s:'',
        a:[true,false,true,false,true,true,false,true,false,true,true,false,],
      },
      {
        t:'minor',
        n:['aeolian'],
        s:'',
        a:[true,false,true,true,false,true,false,true,true,false,true,false,],
      },
      {
        t:'locrian',
        n:[],
        s:'',
        a:[true,true,false,true,false,true,true,false,true,false,true,false,],
      },
    ],
  },
	CHORD:{
    toString:function(chord){
      var s = ts.music.NOTES[chord.v].n+ts.music.CHORD.TYPE[chord.t].t;
      if (chord.b!=chord.v)s += '/'+ts.music.NOTES[chord.b].n;
      return s;
    },
    countNotes:function(chord){
      var TYPE = ts.music.CHORD.TYPE[chord.t];
      var count = 0;
      for (var i = 0; i < TYPE.a.length;i++){
        if (TYPE.a[i]==true)count++;
      }
      return count;
    },
    noteFromChordIndex:function(chord,index){
      var TYPE = ts.music.CHORD.TYPE[chord.t];
      var cur_no = 0; if (index==0)return 0;//chord.v;
      for (var i = 1; i < TYPE.a.length;i++){
        if (TYPE.a[i]==true){
          cur_no++;
          if (cur_no==index)
            return (i);
        }
      }
      return 0;
    },
    indexFromChordNote:function(chord,note){
      note = (note+12-chord.v)%12;
      if (note==0) return 0;

      var TYPE = ts.music.CHORD.TYPE[chord.t];
      var cur_no = 0;
      for (var i = 1; i < TYPE.a.length;i++){
        if (TYPE.a[i]==true){
          cur_no++;
          if (i==note)
            return cur_no;
        }
      }
      return -1;
    },
    suggestType:function(t){
      var T = ts.music.CHORD.TYPE;
      for (var i = 0 ; i < T.length;i++){
        if (T[i].t.length>t.length && zs4.string.startsWith(T[i].t,t)){
          return T[i].t;
        }
        for (var x = 0; x < T[i].n.length;x++){
          if (T[i].n[x].length>t.length && zs4.string.startsWith(T[i].n[x],t)){
            return T[i].n[x];
          }
        }
      }
      return t;
    },
    checkType:function(t){
      var T = ts.music.CHORD.TYPE;
      for (var i = 0 ; i < T.length;i++){
        if (T[i].t==t)return true;
        for (var x = 0; x < T[i].n.length;x++){
          if (T[i].n[x]==t)return true;
        }
      }
      return false;
    },
    checkTypeBeginning:function(t){
      var T = ts.music.CHORD.TYPE;
      for (var i = 0 ; i < T.length;i++){
        if (T[i].t.length>=t.length && zs4.string.startsWith(T[i].t,t)){
          return true;
        }
        for (var x = 0; x < T[i].n.length;x++){
          if (T[i].n[x].length>=t.length && zs4.string.startsWith(T[i].n[x],t)){
            return true;
          }
        }
      }
      return false;
    },
		TYPE:[	//				C				D				E		F				G				A				B
			{
        t:"",
        n:[],
        s:'',
        a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	false,	false],
      },
      {
        t:"-",
        n:['m'],
        s:'-',
        a:	[true,	false,	false,	true,	false,	false,	false,	true,	false,	false,	false,	false],
      },
      {
        t:"o",
        n:['dim'],
        s:'&#x00B0;',
        a:	[true,	false,	false,	true,	false,	false,	true,	false,	false,	false,	false,	false],
      },
			{
        t:"+",
        n:[],
        s:'+',
        a:	[true,	false,	false,	false,	true,	false,	false,	false,	true,	false,	false,	false],
      },
			{
        t:"-6",
        n:['m6'],
        s:'-&#x2076;',
        a:	[true,	false,	false,	true,	false,	false,	false,	true,	false,	true,	false,	false],
      },
			{
        t:"-7",
        n:['m7'],
        s:'-&#x2077;',
        a:	[true,	false,	false,	true,	false,	false,	false,	true,	false,	false,	true,	false],
      },
      {
        t:"-7b5",
        n:['m7b5'],
        s:'&#x2300;',
        a:	[true,	false,	false,	true,	false,	false,	true,	false,	false,	false,	true,	false],
      },
      {
        t:"6",
        n:[],
        s:'&#x2076;',
        a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	true,	false,	false],
      },
			{
        t:"7",
        n:[],
        s:'&#x2077;',
        a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	true,	false],
      },
			{
        t:"M7",
        n:[],
        s:'&#x25B3;',
        a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	false,	true],
      },
			{
        t:"+7",
        n:['aug7'],
        s:'+&#x2077;',
        a:	[true,	false,	false,	false,	true,	false,	false,	false,	true,	false,	true,	false],
      },
			{
        t:"o7",
        n:['dim7'],
        s:'&#x00B0;&#x2077;',
        a:	[true,	false,	false,	true,	false,	false,	true,	false,	false,	true,	false,	false],
      },

			{
        t:"7b9",
        n:[],
        s:'&#x2077;&#x1D47;&#x2079;',
        a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	true,	false, false, true],
      },
		],
	},
});

ts.player = new Object({
	internal:{
		iterationCount:0,
		chord:null,
		bar:{
			jump:false,
			jumpEvent:0,
			jumpTs:null,
			jumpEventEle:null,

			active:{
				startTime:0,
				duration:0,
				eventCount:0,
				nextEventTime:0,
				interval:0,

			},
		},
		initialTime:0,
    osc:{
    },
    ATTACKRELEASE:20,
		timeout:100,
    barTicks:0,
    barTicks:0,
    playNote:function(oscillator,note,velocity,start,duration){
      var AR = ts.player.internal.ATTACKRELEASE;
      if (duration < (AR*2)) AR = duration/2;
      oscillator.noteAtTime(note,start);
      oscillator.fadeToBy(velocity,start,AR);
      oscillator.fadeToBy(0,start+AR,duration-AR);
    },
    playMelody:function(e){
      if (e.bar.melodies.length==0)return;
      //zs4.debug('PLAYING MELODY',e);
      var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      var SEQ = ts.player.ts;

      var available = SEQ.barTotalMillies;
      var a = e.arrayMelody;

      //zs4.debug(a);

      for (var i = 0; i < a.length; i++){
        pi.playNote(CHANNEL.melody,a[i].event.melody,1,a[i].starttime,a[i].ticktime);
      }
		},
    playBass:function(e){
      const BASS_OFFSET = 36;
      var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      var SEQ = ts.player.ts;
      //zs4.debug(e);

      var a = e.playArray;
      var chord = pi.chord;

      for (var i = 0; i < a.length;i++){
        if (a[i].chord != null)chord = a[i].chord.chord;
        if (chord==null)continue;
        var note = chord.b + BASS_OFFSET;
        var velocity = .2;
        if ((i%SEQ.tpb)==0)velocity=.5;
        pi.playNote(CHANNEL.bass,note,velocity,a[i].starttime,a[i].ticktime);
      }
    },
    playAccompaniment:function(e){
      const CHORD_OFFSET = 60;
      var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      var SEQ = ts.player.ts;

      pi.playBass(e);

      var a = e.playArray;
      var chord = pi.chord;

      var CHORD = ts.music.CHORD;
      function q(v){return ts.music.note.qualified(v);}
      var velocity = 0.3;
      for (var i = 0; i < a.length;i++){

        var done = [false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false,false];

        if (a[i].chord != null)chord = a[i].chord.chord;
        if (chord==null)continue;
        var chordNoteCount = CHORD.countNotes(chord);
        var bar_bass_index = CHORD.indexFromChordNote(chord,chord.b);
        if (bar_bass_index>=0)done[bar_bass_index]= true;
        else if (chordNoteCount>3)done[2]=true;
        var index = 0;
        var newIndex = function(){
          while (done[index]==true)index++;
          done[index]=true;
          return (index%chordNoteCount);
        };

        if ((i%SEQ.tpb)!=0) continue;
        var root = chord.v + CHORD_OFFSET;

        // TENOR
        var tenor_note = root+CHORD.noteFromChordIndex(chord,newIndex());
        pi.playNote(CHANNEL.tenor,tenor_note,velocity,a[i].starttime,SEQ.beatMillies);

        // ALTO
        var alto_note = root+CHORD.noteFromChordIndex(chord,newIndex());
        pi.playNote(CHANNEL.tenor,tenor_note,velocity,a[i].starttime,SEQ.beatMillies);

        // SOPRANO
        var soprano_note = root+CHORD.noteFromChordIndex(chord,newIndex());
        pi.playNote(CHANNEL.tenor,tenor_note,velocity,a[i].starttime,SEQ.beatMillies);


        /*
        zs4.debug(
          'chord:'+ts.music.CHORD.toString(chord),
          chord,
          't:'+ts.music.note.qualified(tenor_note),
          'a:'+ts.music.note.qualified(alto_note),
          's:'+ts.music.note.qualified(soprano_note)
        )
        */
      }

		},
    playBar:function(bar){
      //zs4.debug('PLAYING BAR',bar);
      var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      var SEQ = ts.player.ts;

      SEQ.recomputeBar(bar);

      //var before = Date.now();
      pi.playMelody(bar);
      pi.playAccompaniment(bar);

      var e = bar;
      var a = e.playArray;

      var count = a.length;
      var i = 0;
      var time = 0;
      var progress;

      progress = function(){
        //if (a[i].melody!=null){SEQ.showEventAsCurrent(a[i].melody);}
        //else if (a[i].chord!=null){SEQ.showEventAsCurrent(a[i].chord);}

        i++;
        if (i<count){
          setTimeout(progress,SEQ.tickMillies)
        }
      };
      progress();

    },
		eventLoop:function(){
      //if (ts==null)return;
			var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      // initialize oscillators
      if (pi.osc.mel == null){
        pi.osc.mel = new CHANNEL.oscillator({name:'melody',});
        pi.osc.chord = new Object({
          bass:new CHANNEL.oscillator({name:'bass',}),
          tenor:new CHANNEL.oscillator({name:'tenor',}),
          alto:new CHANNEL.oscillator({name:'alto',}),
          soprano:new CHANNEL.oscillator({name:'soprano',}),
        });
      }

			pi.time = (new Date).getTime();
			var SEQ = ts.player.ts;

			if (SEQ != null){
				var ce = SEQ.evt_current;

				if (pi.bar.active.startTime==0){
					pi.bar.active.startTime = pi.time;
          pi.barTicks = 0;
          for (var n in pi.pos){
            pi.pos[n].prev = pi.pos[n].curr = pi.pos[n].next = null;
          }
				}else{
					pi.bar.active.startTime = pi.bar.active.nextEventTime;
				}
				pi.bar.active.nextEventTime = pi.bar.active.startTime + ce.duration;


				// LOOP ENDING!!!! PUT STUFF BEFORE!!!!
				// look-ahead! if a bar is upcoming.
				var nextIdx = SEQ.searchNextEvent();
				if (pi.bar.active.nextEventTime > (pi.time)){
          if (SEQ.evt[nextIdx].isBar()){
            pi.timeout = (pi.bar.active.nextEventTime - (pi.time));
          }
          else {
            var want = (pi.bar.active.nextEventTime - (pi.time));
            pi.timeout = (want + (SEQ.tickMillies-1))%SEQ.tickMillies;
          }
        }
				else {
          pi.timeout = 0;
        }

        var e = SEQ.evt[nextIdx];

				if (SEQ.current_tool) SEQ.current_tool.refresh();
				if (SEQ.current_inst) SEQ.current_inst.refresh();

				if (e.bar && pi.bar.jump){

					if (ts != pi.bar.jumpTs){
						ts.player.attach(pi.bar.jumpTs);
						SEQ = ts.player.ts;
						ce = SEQ.evt_current;
					}
					pi.bar.jumpEventEle.className = '';
					SEQ.setCurrentEvent(SEQ.evt[pi.bar.jumpEvent]);
					pi.bar.jump = false;
				}
        else{
					SEQ.setNextEvent();
				}
        //ce = SEQ.evt_current;

        //update running harmonic and rhythmic state
        if (ce.isChord())	{
  				pi.chord = ce.chord;
  				pi.beatsSinceChord = 0;
  			}
        if (ce.isBar()) {
  				pi.currentBeat = 0;
  				pi.beatsSinceChord = 0;
  				//zs4.debug('bar');
  			}
  			else if (ce.isBeat()) {
  				pi.currentBeat += 1;
  				pi.beatsSinceChord += 1;
  				//zs4.debug('beat '+(pi.currentBeat+1) );
  			}

        if (ce.isBar()){
          pi.playBar(ce);
        }
				//pi.playMelody(ce);

			}
			else if (ts.player.internal.bar.jump && ts.player.internal.bar.jumpTs != null ){
				ts.player.internal.bar.jumpEventEle.className = '';
				ts.player.attach(ts.player.internal.bar.jumpTs);
				ts.player.ts.setCurrentEvent(ts.player.ts.evt[ts.player.ts.evt_curidx]);
				ts.player.internal.bar.jump = false;
			}

      if (ts.player.ts != null){
        setTimeout(pi.eventLoop,pi.timeout);
      }
			else {
        setTimeout(pi.eventLoop,100);
      }
		},

	},
	ts:null,
	html:null,
	initialize:function(){
		if (ts.player.html != null) return ts.player.html;

		ts.player.html = ts.html.nu.ele('ts-player');
		//ts.player.html.textContent = 'Player';

		ts.player.internal.initialTime = (new Date).getTime();
		setTimeout(ts.player.internal.eventLoop,ts.player.internal.timeout);
	},
	is:{
		running:function(){
			if (ts.player.ts != null)return true;
			return false;
		},
	},
	attach:function(nuTs){
    if (nuTs==ts.player.ts)return;
		ts.player.detach();
		zs4.admin.util.setIcon(nuTs.titlebarLogo,'stop');
		nuTs.titlebarElement.appendChild(ts.player.html);
		nuTs.player = ts.player.html;
		ts.player.ts = nuTs;
    nuTs.onPlayingStarted();

	},
	detach:function(){
		if (ts.player.ts != null){
			if (ts.player.ts.player != null){
				ts.player.ts.titlebarElement.removeChild(ts.player.ts.player);
				ts.player.ts.player = null;
			}
			var keep = ts.player.ts;
			zs4.admin.util.setIcon(keep.titlebarLogo,'play');
			ts.player.ts = null;
			keep.onPlayingDone();
		}
	},
	onEventClick:function(clickTs,evt){
		var idx = clickTs.getEventIndex(evt);
		if (ts.player.internal.bar.jumpEventEle!=null)
			ts.player.internal.bar.jumpEventEle.className = '';

		if (clickTs.evt[idx].bar == null)
			idx = clickTs.searchPrevBar((idx+clickTs.evt.length));

		ts.player.internal.bar.jump = true;
		ts.player.internal.bar.jumpEvent = idx;
		ts.player.internal.bar.jumpEventEle = clickTs.evt[idx].eEvent;
		ts.player.internal.bar.jumpTs = clickTs;
		ts.player.internal.bar.jumpEventEle.className = 'jumpToEvent';
	},
	onLogoClick:function(clickTs){
		if (clickTs == ts.player.ts){
			if (clickTs.player == ts.player.html){
				ts.player.detach();
			} else {
				ts.player.attach(clickTs);
			}
		} else {
			if (clickTs.player == ts.player.html){
				alert("idle ts object, player active.");
			} else {
				ts.player.internal.bar.active.startTime = 0;
        var SEQ = clickTs;
        var idx = SEQ.evt_curidx;
        if (SEQ.evt_current.isBar()){
          idx = SEQ.evt_curidx;
        }
        else {
          idx = SEQ.searchPrevBar(SEQ.evt_curidx);
        }

				ts.player.onEventClick(clickTs,clickTs.evt[idx]);
			}
		}
	},
});

ts.playNote = function(channel,note,volume,millies){};

ts.initialize = function(){
	if (ts.initialized) return true;
	ts.initialized = true;

	//initialize Audio
	ts.audio.initialize();
	//initialize MIDI
	ts.midi.initialize();
	// initialize Player
	ts.player.initialize();

	if (ts.audio.initialized){
		ts.playNote = ts.audio.play.note;
	}
	else
	if (ts.midi.initialized){
		ts.playNote = ts.midi.play.note;
	}

	return ts.initialized;
};

ts.initialized = false;

ts.html = new Object({
  init:{
		block:function(container){

			var ele = ts.html.nu.ele('ts');
			ele.style.display = 'block';
			//ele.style.fontSize = 'xx-small';
			container.appendChild(ele);
			//ele.width = '100%';
			//ele.height = '32em';
			//ele.ts = nu;

			var SEQ = new ts.create();
			ele.ts = SEQ;
			container.ts = SEQ;

			SEQ.ele = ele;

			ts.initialize();

			// make a title bar;
			SEQ.titlebarElement = ts.html.nu.ele('ts-titlebar');
			SEQ.titlebarElement.style.display = 'block';
			ele.appendChild(SEQ.titlebarElement);

      SEQ.kbIconMode = function(ele,active){
        if (active){
          ele.style.backgroundColor='rgba(255,0,0,0.3)';
          ele.style.border='0.05em solid red';
          ele.style.borderRadius = '0.5em';
        }
        else {
          ele.style.backgroundColor='initial';
          ele.style.border='initial';
          ele.style.borderRadius = 'initial';
        }
      }

      SEQ.createKeyboardModes = function(parent){
        var kbm = ts.html.nu.ele('ts-kbm');
				parent.appendChild(kbm);

        var timing = zs4.admin.util.addIconElement(kbm,'bpm');
        timing.onclick = function(){
          SEQ.kbm = KBM_BAR;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };

        var beat = zs4.admin.util.addIconElement(kbm,'beat');
        beat.onclick = function(){
          SEQ.kbm = KBM_BEAT;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };

        var chord = zs4.admin.util.addIconElement(kbm,'chord');
        chord.onclick = function(){
          SEQ.kbm = KBM_CHORD;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };

        var melody = zs4.admin.util.addIconElement(kbm,'note');
        melody.onclick = function(){
          SEQ.kbm = KBM_MELODY;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };

				var lyric = zs4.admin.util.addIconElement(kbm,'lyric');
        lyric.onclick = function(){
          SEQ.kbm = KBM_LYRIC;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };

        var prev = zs4.admin.util.addIconElement(kbm,'prev');
				prev.onclick = function(){SEQ.kbLeft();}
				var next = zs4.admin.util.addIconElement(kbm,'next');
				next.onclick = function(){SEQ.kbRight();}

        SEQ.kb.refresh = function(){
          if (SEQ.isPlaying()){
            prev.style.display = 'none';
            next.style.display = 'none';
          }
          else {
            prev.style.display = 'inline-block';
            next.style.display = 'inline-block';
          }

          if (SEQ.kbm==KBM_BAR||SEQ.kbm==KBM_BEAT){
            beat.style.display = 'inline-block';
          }
          else {
            beat.style.display = 'none';
          }

          SEQ.kbIconMode(timing,SEQ.kbm == KBM_BAR);
          SEQ.kbIconMode(beat,SEQ.kbm == KBM_BEAT);
          SEQ.kbIconMode(melody,SEQ.kbm == KBM_MELODY);
          SEQ.kbIconMode(lyric,SEQ.kbm == KBM_LYRIC);
          SEQ.kbIconMode(chord,SEQ.kbm == KBM_CHORD);

          if (SEQ.current_inst!=null){
            SEQ.current_inst.refresh();
            chord.style.display = 'none'
            melody.style.display = 'none'
          }
          else {
            chord.style.display = 'inline-block'
            melody.style.display = 'inline-block'
          }
        };
      };

			SEQ.tsTopTools = ts.html.nu.ele('ts-top-tools');
      //nu.tsTopTools.style.fontSize =
			SEQ.titlebarElement.appendChild(SEQ.tsTopTools);

			SEQ.titlebarLogo = ts.html.nu.ele('ts-titlebar-logo');
			SEQ.titlebarLogo.ts = SEQ;
			SEQ.titlebarLogo.onclick = function(){
        this.ts.onLogoClick();
      };
			zs4.admin.util.setIcon(SEQ.titlebarLogo,'play');
			SEQ.tsTopTools.appendChild(SEQ.titlebarLogo);

			SEQ.player = null;

			SEQ.toolinst = ts.html.nu.ele('ts-instbutton');
			zs4.admin.util.setIcon(SEQ.toolinst,'instruments');
			SEQ.instArePopped = false;
			SEQ.toolinst.onclick = function(){
				if (SEQ.instArePopped==true){
					SEQ.instpopped.style.display = 'none';
					SEQ.instArePopped = false;
				}else{
					SEQ.instpopped.style.display = 'block';
					SEQ.instArePopped = true;
					SEQ.toolspopped.style.display = 'none';
					SEQ.toolsArePopped = false;
					SEQ.hideAllInstPanes();
				}
        SEQ.adaptContentPane();
			};
			SEQ.tsTopTools.appendChild(SEQ.toolinst);

      SEQ.createKeyboardModes(SEQ.tsTopTools);

			SEQ.toolpop = ts.html.nu.ele('ts-toolbutton');
			zs4.admin.util.setIcon(SEQ.toolpop,'tool');
			SEQ.toolsArePopped = false;
			SEQ.toolpop.onclick = function(){
				if (SEQ.toolsArePopped==true){
					SEQ.toolspopped.style.display = 'none';
					SEQ.toolsArePopped = false;
				}
        else if (!SEQ.isPlaying()){
					SEQ.toolspopped.style.display = 'block';
					SEQ.toolsArePopped = true;
					SEQ.instpopped.style.display = 'none';
					SEQ.instArePopped = false;
					SEQ.current_tool = null;
					SEQ.hideAllToolPanes();
				}
        SEQ.adaptContentPane();
			};
			SEQ.tsTopTools.appendChild(SEQ.toolpop);

			SEQ.toolspopped = ts.html.nu.ele('ts-tool-icons');
			SEQ.toolspopped.style.display = 'none';
			SEQ.titlebarElement.appendChild(SEQ.toolspopped);

			SEQ.instpopped = ts.html.nu.ele('ts-inst-icons');
			SEQ.instpopped.style.display = 'none';
			SEQ.titlebarElement.appendChild(SEQ.instpopped);

			//
			SEQ.toolarea = ts.html.nu.ele('ts-toolarea');
			SEQ.toolarea.style.display = 'block';
			ele.appendChild(SEQ.toolarea);

			SEQ.instarea = ts.html.nu.ele('ts-instarea');
			SEQ.instarea.style.display = 'block';
			ele.appendChild(SEQ.instarea);

			// create content bin
			SEQ.cnt = ts.html.nu.ele('ts-content');
			SEQ.cnt.style.marginLeft = '.5em';
			SEQ.cnt.style.display = 'block';
      SEQ.cnt.tabIndex=0;
      SEQ.cnt.style.outlineWidth='0px';
			ele.appendChild(SEQ.cnt);
      SEQ.cnt.focus();

      SEQ.adaptContentPane = function(){
        if (SEQ.current_tool == null && SEQ.current_inst == null){
          SEQ.cnt.style.maxHeight = 'initial';
    			SEQ.cnt.style.overflowY = 'initial';
        }
        else {
          SEQ.cnt.style.maxHeight = (window.innerHeight/2)+'px';
    			SEQ.cnt.style.overflowY = 'scroll';
        }
      };
      SEQ.createEvent = function(txt,mus,pos){
        if (SEQ.isPlaying())return null;

        if (SEQ.evt.length==0)pos=0;
        else pos %= SEQ.evt.length;

        var e = SEQ.addEvent(txt,mus,pos);
        SEQ.alignHTML();

        return e;
      };
      SEQ.deleteCurrentEvent = function(pos){
        if (pos < 0 || pos >= SEQ.evt.length)return false;
        SEQ.cnt.removeChild(SEQ.evt[pos].eEvent);
        SEQ.evt.splice(pos,1);
        SEQ.setCurrentEvent(SEQ.evt_curidx);
        return true;
      }

      SEQ.isCharacterKeyPress = function(evt) {
          if (typeof evt.which == "undefined") {
              // This is IE, which only fires keypress events for printable keys
              return true;
          } else if (typeof evt.which == "number" && evt.which > 0) {
              // In other browsers except old versions of WebKit, evt.which is
              // only greater than zero if the keypress is a printable key.
              // We need to filter out backspace and ctrl/alt/meta key combinations
              return !evt.ctrlKey && !evt.metaKey && !evt.altKey && evt.which != 8;
          }
          return false;
        };

      SEQ.setKbmMode = function(m){
        SEQ.kbm = m;
        SEQ.evt_current.refresh();
        SEQ.kb.refresh();
      }

      SEQ.eventListenerKeypress = function(e){
        e.preventDefault();
        console.log(e);
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        if (SEQ.isPlaying())return;

        if (SEQ.kbm == KBM_LYRIC){
          if (SEQ.isCharacterKeyPress(e)){
            //console.log('PRINTABLE!!!!');
            var ch = String.fromCharCode(e.which);
            if (ch==' '||ch=='\n'){
              var curidx = SEQ.evt_curidx;
              if (SEQ.kb.pos==0){
                var nu = SEQ.createEvent(EVENT.lyric,'',curidx+1);
                EVENT.lyric = ch;
                EVENT.space = true;
                if (ch=='\n')EVENT.linefeed=true;
                SEQ.kb.pos=1;
                EVENT.refresh();
                SEQ.kb.pos=0;
                SEQ.setCurrentEvent(nu);
                e.preventDefault();
              }
              else if (SEQ.kb.pos==EVENT.lyric.length){
                var nu = SEQ.createEvent(ch,'',curidx+1);
                SEQ.kb.pos=1;
                SEQ.setCurrentEvent(nu);
                e.preventDefault();
              }
              else {
                var end = EVENT.lyric.substr(SEQ.kb.pos,EVENT.lyric.length-SEQ.kb.pos)
                EVENT.lyric = EVENT.lyric.substr(0,SEQ.kb.pos);
                EVENT.refresh();
                var nu = SEQ.createEvent(ch,'',curidx+1);
                SEQ.setCurrentEvent(nu);
                EVENT = SEQ.evt_current;
                var tail = SEQ.createEvent(end,'',SEQ.evt_curidx+1);
                SEQ.kb.pos=1;
                SEQ.setCurrentEvent(nu);
              }
            }
            else {
              EVENT.lyric = EVENT.lyric.substr(0,SEQ.kb.pos)+
              ch+
              EVENT.lyric.substr(SEQ.kb.pos,EVENT.lyric.length-SEQ.kb.pos);
              SEQ.kb.pos++;
              EVENT.refresh();
              e.preventDefault();
            }
          }
        }
        else if (SEQ.kbm == KBM_CHORD){
          if (SEQ.isCharacterKeyPress(e)){

          }
        }

      };

      SEQ.kbLeft = function(){
        if (SEQ.kbm == KBM_EVENT){
          SEQ.kbLeftEvent();
        }
        else if (SEQ.kbm == KBM_BAR){
          SEQ.kbLeftBar();
        }
        else if (SEQ.kbm == KBM_BEAT){
          SEQ.kbLeftBeat();
        }
        else if (SEQ.kbm == KBM_LYRIC){
          SEQ.kbLeftLyric();
        }
        else if (SEQ.kbm == KBM_CHORD){
          SEQ.kbLeftChord();
        }
        else if (SEQ.kbm == KBM_MELODY){
          SEQ.kbLeftMelody();
        }
      };
      SEQ.kbRight = function(){
        if (SEQ.kbm == KBM_EVENT){
          SEQ.kbRightEvent();
        }
        else if (SEQ.kbm == KBM_BAR){
          SEQ.kbRightBar();
        }
        else if (SEQ.kbm == KBM_BEAT){
          SEQ.kbRightBeat();
        }
        else if (SEQ.kbm == KBM_LYRIC){
          SEQ.kbRightLyric();
        }
        else if (SEQ.kbm == KBM_CHORD){
          SEQ.kbRightChord();
        }
        else if (SEQ.kbm == KBM_MELODY){
          SEQ.kbRightMelody();
        }
      };
      SEQ.kbLeftEvent = function(){
        SEQ.setPreviousEvent();
        SEQ.kb.pos = 'end';
      };
      SEQ.kbRightEvent = function(){
        SEQ.setNextEvent();
        SEQ.kb.pos = 'start';
      };
      SEQ.kbLeftBar = SEQ.kbLeftEvent;
      SEQ.kbRightBar = SEQ.kbRightEvent;
      SEQ.kbLeftBeat = SEQ.kbLeftEvent;
      SEQ.kbRightBeat = SEQ.kbRightEvent;
      SEQ.kbLeftLyric = function(){
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        if (SEQ.kb.pos>0){
          SEQ.kb.pos--;
          EVENT.refresh();
        }
        else {
          SEQ.setPreviousEvent();
          SEQ.kb.pos = 'end';
          EVENT.refresh();
          SEQ.evt_current.refresh();
        }
      };
      SEQ.kbRightLyric = function(){
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        if (SEQ.kb.pos<EVENT.lyric.length){
          SEQ.kb.pos++;
          EVENT.refresh();
        }
        else {
          SEQ.setNextEvent();
          SEQ.kb.pos = 'start';
          EVENT.refresh();
          SEQ.evt_current.refresh();
        }
      };
      SEQ.kbLeftChord = function(){
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        if (SEQ.kb.pos>0){
          SEQ.kb.pos--;
          EVENT.refresh();
        }
        else {
          SEQ.setPreviousEvent();
          SEQ.kb.pos = 'end';
          SEQ.kb.chord = null;
          EVENT.refresh();
          SEQ.evt_current.refresh();
        }
      };
      SEQ.kbRightChord = function(){
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        if (SEQ.kb.pos<SEQ.kb.chord.length){
          SEQ.kb.pos++;
          EVENT.refresh();
        }
        else {
          SEQ.setNextEvent();
          SEQ.kb.pos = 'start';
          SEQ.kb.chord = null;
          EVENT.refresh();
          SEQ.evt_current.refresh();
        }
      };
      SEQ.kbLeftMelody = function(){
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevLyric(SEQ.evt_curidx)]);
      };
      SEQ.kbRightMelody = function(){
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;
        SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextLyric(SEQ.evt_curidx)]);
      };

      SEQ.eventListenerKeydown = function(e){
        function isEsc(){if ((e.key=='Escape')||(e.key=='Esc'))return true; return false;}

        function isLeft(){if ((e.key=='ArrowLeft')||(e.key=='Left'))return true; return false;}
        function isRight(){if ((e.key=='ArrowRight')||(e.key=='Right'))return true; return false;}
        function isUp(){if ((e.key=='ArrowUp')||(e.key=='Up'))return true; return false;}
        function isDown(){if ((e.key=='ArrowDown')||(e.key=='Down'))return true; return false;}

        //e.preventDefault();
        console.log(e);
        var EVENT = SEQ.evt_current;
        if (EVENT==null)return;

        // IN ANy context
        // NAVIGATION
        if (!SEQ.isPlaying()){

          if (e.altKey || e.ctrlKey){
            if (e.key=='p'){
              SEQ.onLogoClick(SEQ);
              e.preventDefault();
              return false;
            }

            else if (e.key=='b'){
              SEQ.setKbmMode(KBM_BAR);
              e.preventDefault();
              return false;
            }
            else if (e.key=='B'){
              SEQ.setKbmMode(KBM_BEAT);
              e.preventDefault();
            }
            else if (e.key=='e'){
              SEQ.setKbmMode(KBM_EVENT);
              e.preventDefault();
            }
            else if (e.key=='t'){
              SEQ.setKbmMode(KBM_LYRIC);
              e.preventDefault();
              return false;
            }
            else if (e.key=='m'){
              SEQ.setKbmMode(KBM_MELODY);
              e.preventDefault();
              return false;
            }
            else if (e.key=='k'){
              SEQ.kb.chord = null;
              SEQ.setKbmMode(KBM_CHORD);
              e.preventDefault();
              return false;
            }

            else if (isUp()){
              SEQ.transpose(1);
              SEQ.refresh();
              e.preventDefault();
            }
            else if (isDown()){
              SEQ.transpose(-1);
              SEQ.refresh();
              e.preventDefault();
            }

            e.preventDefault();
          }

          if (SEQ.kbm == KBM_EVENT){

            if (e.key=='Home')SEQ.setCurrentEvent(SEQ.evt[0]);

            else if (isRight()&&!e.shiftKey){
              SEQ.kbRightEvent();
              e.preventDefault();
            }
            else if (isLeft()&&!e.shiftKey){
              SEQ.kbLeftEvent();
              e.preventDefault();
            }

          }
          else if (SEQ.kbm == KBM_BAR){
            if (isEsc()){
              SEQ.kbm = KBM_EVENT;
              SEQ.evt_current.refresh();
              e.preventDefault();
            }
            else if (isRight()&&!e.shiftKey){
              SEQ.kbRightBar();
              e.preventDefault();
            }
            else if (isLeft()&&!e.shiftKey){
              SEQ.kbLeftBar();
              e.preventDefault();
            }
            else if ((e.key=='B')||(e.key=='b')){
    					EVENT.toggleBar();
              EVENT.refresh();
              e.preventDefault();
            }
          }
          else if (SEQ.kbm == KBM_BEAT){
            if (isEsc()){
              SEQ.kbm = KBM_EVENT;
              SEQ.evt_current.refresh();
              e.preventDefault();
            }
            else if (isRight()&&!e.shiftKey){
              SEQ.kbRightBeat();
              e.preventDefault();
            }
            else if (isLeft()&&!e.shiftKey){
              SEQ.kbLeftBeat();
              e.preventDefault();
            }
            else if ((e.key=='B')||(e.key=='b')){
    					EVENT.toggleBeat();
              EVENT.refresh();
              e.preventDefault();
            }
          }
          else if (SEQ.kbm == KBM_LYRIC){
            if (isEsc()){
              SEQ.kbm = KBM_EVENT;
              SEQ.evt_current.refresh();
              e.preventDefault();
            }
            else if (isRight()&&!e.shiftKey){
              SEQ.kbRightLyric();
              e.preventDefault();
            }
            else if (isLeft()&&!e.shiftKey){
              SEQ.kbLeftLyric();
              e.preventDefault();
            }
            else if (e.key=='Delete'){
              if (SEQ.kb.pos<EVENT.lyric.length){
                EVENT.lyric = EVENT.lyric.substr(0,SEQ.kb.pos)+
                  EVENT.lyric.substr(SEQ.kb.pos+1,EVENT.lyric.length-SEQ.kb.pos-1);
                EVENT.refresh();
                e.preventDefault();
              }
              else {
                var ei = SEQ.searchNextEvent(SEQ.evt_curidx,function(e){if (e.lyric.length>0)return true;return false;});
                if (ei==SEQ.evt_curidx)return;
                SEQ.setCurrentEvent(SEQ.evt[ei]);
                EVENT = SEQ.evt_current;
                EVENT.lyric = EVENT.lyric.substr(1,EVENT.lyric.length-1);
                SEQ.kb.pos = 0;
                EVENT.refresh();
                e.preventDefault();
              }
            }
            else if (e.key=='Backspace'){
              if (SEQ.kb.pos>0){
                SEQ.kb.pos--;
                EVENT.lyric = EVENT.lyric.substr(0,SEQ.kb.pos)+
                  EVENT.lyric.substr(SEQ.kb.pos+1,EVENT.lyric.length-SEQ.kb.pos-1);
                EVENT.refresh();
                e.preventDefault();
              }
              else {
                var ei = SEQ.searchPrevEvent(SEQ.evt_curidx,function(e){if (e.lyric.length>0)return true;return false;});
                if (ei==SEQ.evt_curidx)return;
                SEQ.setCurrentEvent(SEQ.evt[ei]);
                EVENT = SEQ.evt_current;
                EVENT.lyric = EVENT.lyric.substr(1,EVENT.lyric.length-1);
                SEQ.kb.pos = EVENT.lyric.length;
                EVENT.refresh();
                e.preventDefault();
              }
            }

          }
          else if (SEQ.kbm == KBM_MELODY){
            if (isEsc()){
              SEQ.kbm = KBM_EVENT;
              SEQ.evt_current.refresh();
            }
            else if (isRight()&&!e.shiftKey){
              SEQ.kbRightMelody();
              e.preventDefault();
            }
            else if (isLeft()&&!e.shiftKey){
              SEQ.kbLeftMelody();
              e.preventDefault();
            }
          }
          else if (SEQ.kbm == KBM_CHORD){
            var slash = SEQ.kb.chord.indexOf('/');
            if (isEsc()){
              SEQ.kbm = KBM_EVENT;
              SEQ.evt_current.refresh();
            }
            else if (isRight()&&!e.shiftKey){
              SEQ.kbRightChord();
              e.preventDefault();
            }
            else if (isLeft()&&!e.shiftKey){
              SEQ.kbLeftChord();
              e.preventDefault();
            }
            else if (e.key=='Enter'){
              var chord = SEQ.kb.chord.substr(0,SEQ.kb.pos);
              var ch = ts.music.parse.chord(chord);
              SEQ.kb.chord = chord;
              SEQ.kb.pos = chord.length;
              if (EVENT.isChord()){
                  EVENT.chord = null;
              }
              else if (ch.ok){
                EVENT.chord = ch;
              }
              SEQ.refresh();
              //EVENT.refresh();
              e.preventDefault();
            }
            else if (e.key=='Tab'&&!e.shiftKey){
              if (SEQ.kb.pos<SEQ.kb.chord.length){
                SEQ.kb.pos = SEQ.kb.chord.length;
                EVENT.refresh();
                e.preventDefault();
              }
              else {
                SEQ.setNextEvent();
                SEQ.kb.pos = 'start';
                SEQ.kb.chord = null;
                EVENT.refresh();
                SEQ.evt_current.refresh();
                e.preventDefault();
              }
            }
            else if (e.key=='Tab'&&e.shiftKey){
              if (SEQ.kb.pos>0){
                SEQ.kb.pos = 0;
                EVENT.refresh();
                e.preventDefault();
              }
              else {
                SEQ.setPreviousEvent();
                SEQ.kb.pos = 'end';
                SEQ.kb.chord = null;
                EVENT.refresh();
                SEQ.evt_current.refresh();
                e.preventDefault();
              }
            }

            else if (SEQ.kb.pos==0){
              if (ts.music.parse.note(zs4.string.to.upper(e.key))!=-1){
                SEQ.kb.chord = zs4.string.to.upper(e.key);
                SEQ.kb.pos=1;
                SEQ.kb.typed = true;
                EVENT.refresh();
                e.preventDefault();
              }
            }
            else if (SEQ.kb.pos==1 && (e.key=='#'||e.key=='b')){
              SEQ.kb.chord = SEQ.kb.chord.charAt(0)+e.key;
              SEQ.kb.pos=2;
              EVENT.refresh();
              e.preventDefault();
            }
            else if (e.key=='/'){
              var ctp = SEQ.kb.ctp();
              var test = SEQ.kb.chord.substr(ctp,SEQ.kb.pos-ctp);
              if (ts.music.CHORD.checkType(test)){
                SEQ.kb.chord = SEQ.kb.chord.substr(0,SEQ.kb.pos)+'/';
                SEQ.kb.pos = SEQ.kb.chord.length;
                SEQ.kb.typed = true;
                EVENT.refresh();
                e.preventDefault();
              }
            }
            else if ((slash>1)&&(SEQ.kb.pos==slash+2)&&(e.key=='#'||e.key=='b')){
              SEQ.kb.chord = SEQ.kb.chord.substr(0,slash+2)+e.key;
              SEQ.kb.pos = slash+=3;
              EVENT.refresh();
              e.preventDefault();
            }
            else if (e.key.length==1&&!e.key.shiftKey){
              if (slash==-1){
                var ctp = SEQ.kb.ctp();
                var test = SEQ.kb.chord.substr(ctp,SEQ.kb.pos-ctp)+e.key;
                if (ts.music.CHORD.checkTypeBeginning(test)){
                  SEQ.kb.chord = SEQ.kb.chord.substr(0,ctp)+test;
                  SEQ.kb.pos++;
                  EVENT.refresh();
                  e.preventDefault();
                }
              }
              else if (slash==SEQ.kb.pos-1){
                var n = ts.music.parse.note(zs4.string.to.upper(e.key));
                if (n!=-1){
                  SEQ.kb.chord = SEQ.kb.chord.substr(0,SEQ.kb.pos)+e.key;
                  SEQ.kb.pos++;
                  EVENT.refresh();
                  e.preventDefault();
                }
              }
            }

          }

          if (SEQ.current_inst != null){


          }
        }
        else {
          if ((isEsc())
          || ((e.altKey||e.ctrlKey)&&(e.key==p))
          ){
            ts.player.onLogoClick(SEQ);
            e.preventDefault();
          }
          else if (isUp()&&(e.altKey||e.ctrlKey)){
            SEQ.transpose(1);
            SEQ.refresh();
            e.preventDefault();
          }
          else if ((isDown())&&(e.altKey||e.ctrlKey)){
            SEQ.transpose(-1);
            SEQ.refresh();
            e.preventDefault();
          }
        }
        if (e.ctrlKey){
          e.preventDefault();
        }
        SEQ.kb.refresh();
      };

      SEQ.tsKeyboard = function(element){
        element.tabIndex=0;
        element.style.outlineWidth='0px';
        if (element.addEventListener){
          //window.alert('addEventListener()');
          element.addEventListener('keydown',SEQ.eventListenerKeydown);
          element.addEventListener('keypress',SEQ.eventListenerKeypress);
        }
        else {
          element.attachEvent('onkeydown',SEQ.eventListenerKeydown);
          element.attachEvent('onkeypress',SEQ.eventListenerKeypress);
        }
      }
      SEQ.tsKeyboard(SEQ.cnt);
      SEQ.tsKeyboard(SEQ.titlebarElement);

      SEQ.onPlayingStarted = function(){
        if (SEQ.isPlaying()){
          SEQ.kb.refresh();
          //window.alert('plaing started');
        }
      };
      SEQ.onPlayingDone = function(){
        if (!SEQ.isPlaying()){
          SEQ.kb.chord = null;
          SEQ.kb.pos = -1;
          SEQ.refresh();
          //window.alert('playing done');
        }
      };

      SEQ.renderStats = function(){
  			this.stsEvents.textContent = ('events:'+this.evt.length+' ');
  			this.stsChords.textContent = ('chords:' + this.stats.chords+' ');
  			this.stsBars.textContent = ('bars:' + this.stats.bars+' ');
  			this.stsBeats.textContent = ('beats:' + this.stats.beats+' ');
  			this.stsNotes.textContent = ('notes:' + this.stats.notes+' ');
  		};
      SEQ.onLogoClick = function(){
  			if (this.evt.length == 0)
  				return;

        if (!SEQ.isPlaying()){
          SEQ.hideAllToolPanes();
          SEQ.toolspopped.style.display = 'none';
          SEQ.toolsArePopped = false;

          if (!SEQ.evt_current.isBar()){
            idx = SEQ.searchPrevBar(SEQ.evt_curidx);
            SEQ.setCurrentEvent(SEQ.evt[idx]);
          }
          SEQ.refresh();
        }

        ts.player.onLogoClick(this);

        //if (!SEQ.isPlaying())this.refresh();
  		};
  		SEQ.onEventClick = function(evt){
  			if (ts.player.is.running()){
  				ts.player.onEventClick(this,evt);
  			}else{
          SEQ.evt_current.refresh();
  				this.setCurrentEvent(evt);
          SEQ.resetKeyboard();
          SEQ.evt_current.refresh();
          SEQ.kb.refresh();
  			}
  		};

      SEQ.resetKeyboard = function(){
        SEQ.kb.pos=0;
        //SEQ.kb.chord=ts.music.CHORD.toString();
      };
  		SEQ.refresh = function(){
  			//zs4.debug('refresh() toonsmith');
  			this.updateStats();
  			this.renderStats();

  			this.recomputeTiming();
  			for (var i = 0; i < this.evt.length; i++)this.evt[i].refresh();
  			for (var i = 0; i < this.tool.length; i++)this.tool[i].refresh();
  			for (var i = 0; i < this.inst.length; i++)this.tool[i].refresh();
  			this.refreshLineFeed();

        SEQ.kb.refresh();

        SEQ.adaptContentPane();
        //SEQ.cnt.focus();

  		};
  		SEQ.refreshLineFeed = function(){
  			var arr = this.evt;
  			for (var i = 0 ; i < arr.length; i++){
  				if (arr[i].isLinefeed()){
  					if (this.toolobject.layout.eLineFeed.checked){
  						arr[i].eLineFeed.style.display='initial';
  					}
  					else {
  						arr[i].eLineFeed.style.display='none';
  					}
  				}
  			}

  		};
  		SEQ.alignHTML = function(){
  			var SEQ = this;
  			var PARENT = SEQ.cnt;
  			for (var i = 0 ; i < (SEQ.evt.length-1) ; i++){
  				PARENT.removeChild(SEQ.evt[i].eEvent);
  				PARENT.insertBefore(SEQ.evt[i].eEvent, PARENT.childNodes[i]);
  			}

  		};

  		SEQ.createTool = function(name,icon,tooltype){
  			var nu = new Object({
  				nam:name,
  				ts:this,
  				visible:false,

  				//arr:this.tool,

  				refresh:function(){},
  				onactivate:function(){},

  				getCurrentEvent:function(){
  					if (this.ts.evt.length == 0 || this.ts.evt_current == null ) return null;
  					return this.ts.evt_current;
  				},
  				getCurrentChord:function(){
  					var e = this.getCurrentEvent();
  					if (e == null)return null;

  					if (e.chord == null || !e.chord.ok) return null;

  					return e.chord;
  				},
  				deleteCurrentChord:function(){
  					var e = this.getCurrentEvent();
  					if (e == null)return null;

  					if (e.chord == null)
  						return null;

  					e.chord = null;
  					return null;
  				},
  				setCurrentChordRoot:function(note){
  					var event = this.getCurrentEvent();
  					if (event == null)return null;

  					var chord = this.getCurrentChord();
  					if (chord == null){
  						chord = ts.music.parse.chord("C");
  						event.chord = chord;
  					}
  					chord.v = chord.b = parseInt(note);
  					chord.t = 0;
  				},
  				setCurrentChordType:function(type){
  					var event = this.getCurrentEvent();
  					if (event == null)return null;

  					var chord = this.getCurrentChord();
  					if (chord == null)return null;

  					chord.t = parseInt(type);
  				},
  				setCurrentChordBass:function(bass){
  					var event = this.getCurrentEvent();
  					if (event == null)return null;

  					var chord = this.getCurrentChord();
  					if (chord == null)return null;

  					chord.b = parseInt(bass);
  				},
  				toggleBar:function(){
  					var event = this.getCurrentEvent();
  					if (event == null)return null;
            event.toggleBar();
  				},
  				toggleBeat:function(){
  					var event = this.getCurrentEvent();
  					if (event == null)return null;
            event.toggleBeat();
  					return event;
  				},
  			});
  			if (tooltype=='i'){
  				nu.arr = this.inst;
  				nu.use = function(){
  					this.ts.instpopped.style.display = 'none';
  					this.ts.instArePopped = false;

  					for (var i = 0; i < this.arr.length; i++){
  						if (this.arr[i]==this){
  								this.toolWindow.style.display = 'block';
  								this.visible = true;
  								this.onactivate();
  								this.refresh();
  								this.ts.current_inst = this;
  								this.ts.current_inst.refresh();
  						}else{
  							this.arr[i].toolWindow.style.display = 'none';
  							this.arr[i].visible = false;
  						}
  					}
            SEQ.kb.refresh();
  				};
  				this.instobject[name] = nu;
  			}
  			else {
  				nu.arr = this.tool;
  				nu.use = function(){
  					this.ts.toolspopped.style.display = 'none';
  					this.ts.toolsArePopped = false;

  					for (var i = 0; i < this.arr.length; i++){
  						if (this.arr[i]==this){
  								this.toolWindow.style.display = 'block';
  								this.visible = true;
  								this.onactivate();
  								this.refresh();
  								this.ts.current_tool = this;
  								this.ts.current_tool.refresh();
  						}else{
  							this.arr[i].toolWindow.style.display = 'none';
  							this.arr[i].visible = false;
  						}
  					}
            SEQ.kb.refresh();
  				};
  				this.toolobject[name] = nu;
  			}

  			if (zs4.is.string(icon)){
  				nu.toolicon = ts.html.nu.ele('ts-tool-icon-'+icon);
  				zs4.admin.util.setIcon(nu.toolicon,icon);
  				if (tooltype=='i') nu.ts.instpopped.appendChild(nu.toolicon);
  				else nu.ts.toolspopped.appendChild(nu.toolicon);
  				//zs4.debug('adding icon for '+icon);
  				nu.toolicon.onclick = function(){nu.use();SEQ.adaptContentPane(); };
  			}

  			nu.toolWindow = ts.html.nu.ele('ts-tool-window');
  			nu.toolWindow.style.display = 'none';
  			nu.toolWindow.ts = this;


  			nu.toolTitlebar = ts.html.nu.ele('ts-tool-titlebar');
  			nu.toolTitlebar.style.display = 'block';
  			nu.toolTitlebar.ts = this;
  			if (tooltype=='i') nu.toolWindow.appendChild(nu.toolTitlebar);
  			else nu.toolWindow.appendChild(nu.toolTitlebar);

        nu.titleIcon = ts.html.nu.ele('ts-tool-titleicon');
  			zs4.admin.util.setIcon(nu.titleIcon,icon);
  			nu.titleIcon.onclick = function(){
  				if (tooltype=='i'){
  					nu.ts.instpopped.style.display = 'block';
  					nu.ts.instArePopped = true;
  					nu.ts.current_inst = null;
  					nu.ts.hideAllInstPanes();
  				}
  				else {
  					nu.ts.toolspopped.style.display = 'block';
  					nu.ts.toolsArePopped = true;
  					nu.ts.current_tool = null;
  					nu.ts.hideAllToolPanes();
  				}
  			};
  			nu.toolTitlebar.appendChild(nu.titleIcon);



  			if (tooltype=='i'){
  				this.instarea.appendChild(nu.toolWindow);
  				this.inst.push(nu);
  			}
  			else {
  				this.toolarea.appendChild(nu.toolWindow);
  				this.tool.push(nu);
  			}


  			return nu;
  		};

  		SEQ.createToolInstrument = function(name,icon){
  			var nu = this.createTool(name,icon,'i');
        SEQ.tsKeyboard(nu.toolWindow);

  			nu.instrument = {
  				name: name,
  				patch:0,
  				perc:false,
  				poly:true,
  				range:{
  					bottom:ts.midi.constant.MIDI_NOTE_MIN,
  					top:ts.midi.constant.MIDI_NOTE_MAX,
  				},
  				ui:[],
  			};

  			nu.createPad = function(note,channel){

  				var e = ts.html.nu.ele('ts-'+nu.instrument.name+'-note');
  				var pad = {
  					song:nu.ts,
  					tool:nu,
  					note:note,
  					channel:channel,
  					isChordNote:false,
  					isChordRoot:false,
  					isMelodyNote:false,
  					isMelodyOctave:false,
  					e:e,
  				}
  				nu.instrument.ui.push(pad);
  				e.ts = pad;

  				e.onclick = function(){
            //if (ts.player.is.running())return;

            if (SEQ.isPlaying()||SEQ.kbm != KBM_MELODY){
              ts.playNote(this.ts.channel,this.ts.note,64,300);
            }
            else {
              if (this.ts.song.evt_current != null){
    						if (this.ts.song.evt_current.melody != this.ts.note){
    							this.ts.song.evt_current.melody = this.ts.note;
    							ts.playNote(this.ts.channel,this.ts.note,64,300);
    						}else{
    							this.ts.song.evt_current.melody = 0;
    						}
                SEQ.evt_current.refresh();
                nu.refresh();
    					}
            }
  				};

  				e.onmouseenter = function(){
  					this.ts.tool.iHoverNote.textContent = ts.music.note.qualified(this.ts.note);
  				};

  				return e;
  			};

  			nu.instrumentRefresh = function(){};
        nu.instrumentKey = function(){return 0;}
        nu.iGeneral = ts.html.nu.ele('ts-instrument-general');
        nu.iGeneral.style.display = 'inline-block';
        nu.toolTitlebar.appendChild(nu.iGeneral);

        var kord = zs4.admin.util.addIconElement(nu.iGeneral,'chord');
        kord.onclick = function(){
          SEQ.kbm = KBM_CHORD;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };

        nu.iCurrentChord = ts.html.nu.ele('ts-instrument-curchord');
        nu.iCurrentChord.style.minWidth = '5em';
        nu.iCurrentChord.style.paddingRight = '1em';
        nu.iGeneral.appendChild(nu.iCurrentChord);

        var melody = zs4.admin.util.addIconElement(nu.iGeneral,'note');
        melody.onclick = function(){
          SEQ.kbm = KBM_MELODY;
          if (SEQ.evt.length>0){
            SEQ.evt_current.refresh();
          }
          SEQ.kb.refresh();
        };
        nu.iHoverNote = ts.html.nu.ele('ts-instrument-hovernote');
        nu.iGeneral.appendChild(nu.iHoverNote);

  			nu.eEventInstrument = ts.html.nu.ele('ts-instrument-' + name);
  			nu.eEventInstrument.className = 'instrument';
  			nu.toolTitlebar.appendChild(nu.eEventInstrument);

				nu.iSpecific = ts.html.nu.ele('ts-instrument-specific');
				nu.iSpecific.style.display = 'block';
				nu.eEventInstrument.appendChild(nu.iSpecific);
				nu.iSpecific.ts = nu;
				nu.iSpecific.onmouseleave = function(){
					this.ts.iHoverNote.textContent = '';
				}

        nu.refresh = function(){
          SEQ.kbIconMode(kord,SEQ.kbm == KBM_CHORD);
          SEQ.kbIconMode(melody,SEQ.kbm == KBM_MELODY);
  				for (var i = 0 ; i < nu.instrument.ui.length ; i++ ){
  					nu.instrument.ui[i].isChordNote =false;
  					nu.instrument.ui[i].isChordRoot =false;
  					nu.instrument.ui[i].isMelodyNote =false;
  					nu.instrument.ui[i].isMelodyOctave =false;
  					nu.instrument.ui[i].e.className = '';
  				}
  				if (nu.ts.evt_current != null){
  					var chord = nu.ts.searchActiveChord();
            var NIK = nu.instrumentKey();
  					if (chord != null){

              transchord = ts.music.parse.chord('C');
              transchord.v = ((60+chord.v) - NIK)%12;
              transchord.t = chord.t;
              transchord.b = ((60+chord.b) - NIK)%12;
              transchord.ok = true;

              nu.iCurrentChord.textContent = ts.music.CHORD.toString(transchord);
  						var className = '';
  						var ch = ts.music.CHORD.TYPE[chord.t].a;
  						for (var i = 0 ; i < nu.instrument.ui.length ; i++ ){
  							var cur_inst_note = (nu.instrument.ui[i].note)%12;
  							for (var x = 0; x < ch.length ; x++ ){
  								var cur_chord_note = ((chord.v + x)%12);
  								if (!ch[x])
  									continue;

  								if (cur_inst_note == cur_chord_note){
  									nu.instrument.ui[i].isChordNote =true;
  									if (x==0){
  										nu.instrument.ui[i].e.className = 'chordroot';
  										nu.instrument.ui[i].isChordRoot = true;
  									}
  									else {
  										nu.instrument.ui[i].e.className = 'chordnote';
  									}
  									break;
  								}
  							}
  						}
  					}
  					else{
  						nu.iCurrentChordRoot.textContent = '';
  						nu.iCurrentChordType.textContent = '';
  					}

  					if (nu.ts.evt_current.melody != 0){
  						for (var i = 0 ; i < nu.instrument.ui.length ; i++ ){
  							if (nu.ts.evt_current.melody == nu.instrument.ui[i].note){
  								nu.instrument.ui[i].isMelodyNote = true;
  							}
  							else if ((nu.ts.evt_current.melody%12) == (nu.instrument.ui[i].note%12)){
  								nu.instrument.ui[i].isMelodyOctave = true;
  							}
  						}
  					}
  				}
  				nu.instrumentRefresh();

  			};

  			return nu;
  		};

  		SEQ.createToolStringInstrument = function(name,icon){

  			var nu = this.createToolInstrument(name,icon);

  			const FRET_COUNT = 7;
  			const KAPO_MAX = 7;
  			const KAPO_MIN = 0;
  			const KAPO_DFT = 0;

        const FRETNO_FONTSIZE = '0.5em'

  			nu.eFretboard = ts.html.nu.ele('table');
  			nu.eFretboard.className = 'ts-fretboard';
  			nu.iSpecific.appendChild(nu.eFretboard);

  			nu.eHeader = ts.html.nu.ele('tr');
  			nu.eFretboard.appendChild(nu.eHeader);

        nu.eTdEmpty = ts.html.nu.ele('td');
  			nu.eHeader.appendChild(nu.eTdEmpty);

        nu.tunArr = new Array();
        nu.tuneObj = function(n,a){
          this.name = n;
          if (zs4.is.array(a)){
            this.a = a;
          }
          else {
            this.a = new Array();
          }
        }
        nu.eTuning = ts.html.nu.ele('select');
        nu.dftTuning = new nu.tuneObj({name:'default',})
        nu.tunArr.push(nu.dftTuning);
        nu.eTuningDefault = ts.html.nu.ele('option');
        nu.eTuningDefault.selected = true;
        nu.eTuningDefault.value = 0;
        nu.eTuningDefault.textContent = 'default';
        nu.eTuning.appendChild(nu.eTuningDefault);
        nu.addTuning = function(tuneObj){
          var v = nu.tunArr.length;
          nu.tunArr.push(tuneObj);
          var opt = ts.html.nu.ele('option');
          opt.value = v;
          opt.textContent = tuneObj.name;
          nu.eTuning.appendChild(opt);
        }
        nu.eTuning.onchange = function(){
          var tun = parseInt(nu.eTuning.value);
          var a = nu.tunArr[tun].a;
          for (var s = 0; s < nu.strings.length; s++){
            var sa = nu.strings[s].tunArr;
            for (var i = 0;i < sa.length; i++){
              var saiv = sa[i].v;
              var as = a[s];
              if (saiv == as){
                sa[i].o.selected = true;
              }
              else {
                sa[i].o.selected = false;
              }
            }
            nu.strings[s].eTuning.value = a[s];
          }
          nu.retune();
          nu.refresh();
        };
        nu.eTdEmpty.appendChild(nu.eTuning);

  			nu.eTdCapo = ts.html.nu.ele('td');
  			nu.eHeader.appendChild(nu.eTdCapo);

  			nu.eKapo = ts.html.nu.ele('select');
  			nu.eKapo.setAttribute('type', 'number');
        for (var k = 0; k <= KAPO_MAX; k++){
          var opt = ts.html.nu.ele('option');
          if (k==KAPO_DFT)opt.selected = true;
          opt.value = k;
          opt.style.fontSize = '0.8em';
          opt.textContent = 'K'+k+'';
          nu.eKapo.appendChild(opt);
        }

  			nu.eKapo.value = KAPO_DFT;
  			nu.eKapo.onchange = function(){
          nu.retune();
          nu.refresh();
        };
        nu.instrumentKey = function(){return parseInt(nu.eKapo.value);}

  			nu.eTdCapo.appendChild(nu.eKapo);

        nu.eFretNumbers = new Array();
  			for (var i = 0; i < FRET_COUNT;i++){
  				var fret = ts.html.nu.ele('td');
  				nu.eHeader.appendChild(fret);
  				fret.style.textAlign = "center";
  				fret.style.fontSize = FRETNO_FONTSIZE;
  				fret.innerHTML = (i+1).toString();
          nu.eFretNumbers.push(fret);
  			}

  			nu.strings = new Array();

  			nu.retune = function(){
          for (var k = 0; k < FRET_COUNT;k++){
            nu.eFretNumbers[k].innerHTML = (parseInt(nu.eKapo.value)+k+1).toString();
          }
  				for (var i = 0; i < nu.strings.length; i++){
  					nu.strings[i].retune();
  				}
  			};

  			nu.createString = (function(tuning){
          nu.dftTuning.a.push(tuning);
  				var string = new Object({
  					fret:new Array(),
  				});
  				nu.strings.push(string);
  				string.eRow = ts.html.nu.ele('tr');
  				string.eRow.className = 'string';
  				string.eRow.style.border = '0';
  				this.eFretboard.appendChild(string.eRow);

  				string.eTdTuning = ts.html.nu.ele('td');
  				string.eTdTuning.className = 'string';
  				string.eRow.appendChild(string.eTdTuning);

          string.tunArr = new Array();
  				string.eTuning = ts.html.nu.ele('select');
  				string.eTdTuning.appendChild(string.eTuning);
  				for (var i = tuning+7 ; i >= tuning-7 ; i-- ){
  					if (i < ts.midi.constant.MIDI_NOTE_MIN)continue;
  					if (i > ts.midi.constant.MIDI_NOTE_MAX)continue;

  					var opt = ts.html.nu.ele('option');
  					opt.value = i;
  					opt.style.fontSize = '0.8em';
            var lbl = ts.music.note.qualified(i);
  					opt.innerHTML = lbl;
  					if (i==tuning){
  						opt.selected = true;
  						string.eTuning.value = i;
  					}
            string.tunArr.push(new Object({v:i,l:lbl,o:opt,}));
  					string.eTuning.appendChild(opt);
  				}
  				string.eTuning.onchange = function(){
  					string.retune();
  				};

  				string.eTdEmpty = ts.html.nu.ele('td');
  				string.eTdEmpty.className = 'string';
          string.eTdEmpty.style.backgroundColor = 'grey';
  				string.eRow.appendChild(string.eTdEmpty);

  				string.eEmptyEle = nu.createPad(i,(tuning));
  				string.pad = string.eEmptyEle.ts;
  				string.eTdEmpty.appendChild(string.eEmptyEle);

  				string.canvas = document.createElement('canvas');
  				string.canvas.style.width = '2em';
  				string.canvas.style.height = '1em';
  				string.eEmptyEle.appendChild(string.canvas);

  				string.retune = function(){
  					string.pad.note = parseInt(string.eTuning.value) + parseInt(nu.eKapo.value);
  					for (var i = 0 ; i < FRET_COUNT; i++){
  						string.fret[i].pad.note = string.pad.note + 1 + i;
  					}
  					nu.refresh();
  				};
  				for (var i = 0 ; i < FRET_COUNT; i++){
  					var fret = new Object();
  					string.fret.push(fret);

  					fret.td = ts.html.nu.ele('td');
  					fret.td.className = 'string';
  					string.eRow.appendChild(fret.td);

  					fret.padele = nu.createPad(i,(tuning+1+i));
  					fret.pad = fret.padele.ts;
  					fret.td.appendChild(fret.padele);

  					fret.canvas = document.createElement('canvas');
  					fret.canvas.style.width = '2em';
  					fret.canvas.style.height = '1em';
  					fret.padele.appendChild(fret.canvas);
  				}
  				string.retune();
  			}).bind(nu);

  			nu.instrumentRefresh = (function(){
          //zs4.debug('STRING INSTRUMENT REFRESH');
  				for (var s = 0 ; s < nu.strings.length; s++){
  					var str = nu.strings[s];

            //zs4.debug('STRING '+s+' REFRESH');

  					var cnf = false;
  					var mnf = false;
  					var mof = false;
  					var pos = 0;

  					function refreshStringPad(pad,canvas){
  						var ctx = canvas.getContext("2d");
  						var w = canvas.width;
  						var h = canvas.height;
  						var max = w; if (h>w) max = h;
  						var min = w; if (h<w) min = h;
  						var lw = max/30;

  						var ctrY = h/2;
  						var ctrX = w/2;
  						var radBig = (min/2);
  						var rad = (min/2.7);
  						var radMel = (min/3.5);
  						var radTiny = (min/4.2);

  						// CLEAR CANVAS
  						ctx.clearRect(0,0,w,h);

  						// DRAW THE STRING AND FRET
  						if (pos>0){
  							ctx.beginPath();
  							ctx.lineWidth = lw;
  							ctx.moveTo(0,ctrY);
  							ctx.lineTo(w,ctrY);
  							ctx.strokeStyle = 'rgba(0,0,0,1)';
  							ctx.stroke();

  							ctx.beginPath();
  							ctx.lineWidth = lw;
  							if (pos==1)ctx.lineWidth = lw*2;
  							ctx.moveTo((lw/2),0);
  							ctx.lineTo((lw/2),h);
  							ctx.strokeStyle = 'rgba(0,0,0,1)';
  							ctx.stroke();
  						}


  						if (pad.isChordRoot){
  							ctx.beginPath();
  							ctx.arc(ctrX, ctrY, radBig, 0, 2 * Math.PI, false);
  							if (cnf){
  								ctx.lineWidth = lw*2;
  					      ctx.strokeStyle = 'rgba(0,128,0,0.7)';
  					      ctx.stroke();
  							}
  							else {
  								ctx.fillStyle = 'rgba(0,128,0,0.7)';
  								ctx.fill();
  								cnf = true;
  							}
  						}
  						else if (pad.isChordNote){
  							ctx.beginPath();
  							ctx.arc(ctrX, ctrY, rad, 0, 2 * Math.PI, false);
  							if (cnf){
  								ctx.lineWidth = lw*2;
  					      ctx.strokeStyle = 'rgba(0,128,0,0.7)';
  					      ctx.stroke();
  							}
  							else {
  								ctx.fillStyle = 'rgba(0,128,0,0.7)';
  								ctx.fill();
  								cnf = true;
  							}
  						}

  						if (pad.isMelodyNote){
  							ctx.beginPath();
  							ctx.arc(ctrX, ctrY, radMel, 0, 2 * Math.PI, false);
  							if (mnf){
  								ctx.lineWidth = lw*2;
  					      ctx.strokeStyle = 'rgba(250,0,0,0.7)';
  					      ctx.stroke();
  							}
  							else {
  								ctx.fillStyle = 'rgba(250,0,0,0.7)';
  								ctx.fill();
  								mnf = true;
  							}
  						}
  						else if (pad.isMelodyOctave){
  							ctx.beginPath();
  							ctx.arc(ctrX, ctrY, radTiny, 0, 2 * Math.PI, false);
  							if (mof){
  								ctx.lineWidth = lw*2;
  					      ctx.strokeStyle = 'rgba(250,0,0,0.7)';
  					      ctx.stroke();
  							}
  							else {
  								ctx.fillStyle = 'rgba(250,0,0,0.7)';
  								ctx.fill();
  								mof = true;
  							}
  						}

  						pos += 1;
  					};

  					refreshStringPad(str.pad,str.canvas);

  					for (var i = 0; i < FRET_COUNT; i++)
  						refreshStringPad(str.fret[i].pad,str.fret[i].canvas);

  				}
  			}).bind(nu);
  			return nu;
  		};
  		SEQ.createToolGuitar = function(){
  			var nu = this.createToolStringInstrument('guitar','guitar');
  			nu.createString(76);
  			nu.createString(71);
  			nu.createString(67);
  			nu.createString(62);
  			nu.createString(57);
  			nu.createString(52);

        //nu.addTuning({name:'standard',a:[76,71,67,62,57,52]});
        nu.addTuning({name:'DADGAD',a:[74,69,67,62,57,50]});
        nu.addTuning({name:'Drop D',a:[76,71,67,62,57,50]});
        nu.addTuning({name:'Open D',a:[74,69,66,62,57,50]});
        nu.addTuning({name:'Open Dm',a:[74,69,65,62,57,50]});
        nu.addTuning({name:'Open G',a:[74,71,67,62,55,50]});
        nu.addTuning({name:'Open Gm',a:[74,70,67,62,55,50]});
        nu.addTuning({name:'Open A',a:[76,69,64,61,57,52]});
  		};
  		SEQ.createToolUkulele = function(){
  			var nu = this.createToolStringInstrument('ukulele','ukulele');
  			nu.createString(81);
  			nu.createString(76);
  			nu.createString(72);
  			nu.createString(79);
  		};
  		SEQ.createToolBass = function(){
  			var nu = this.createToolStringInstrument('bass','bass');
  			nu.createString(55);
  			nu.createString(50);
  			nu.createString(45);
  			nu.createString(40);
        //nu.addTuning({name:'standard',a:[55,50,45,40]});
        nu.addTuning({name:'Drop D',a:[55,50,45,38]});
  		};
  		SEQ.createToolViolin = function(){
  			var nu = this.createToolStringInstrument('violin','violin');
  			nu.createString(88);
  			nu.createString(81);
  			nu.createString(74);
  			nu.createString(67);
  		};
  		SEQ.createToolMandolin = function(){
  			var nu = this.createToolStringInstrument('mandolin','mandolin');
  			nu.createString(88);
  			nu.createString(81);
  			nu.createString(74);
  			nu.createString(67);

        //nu.addTuning({name:'standard',a:[88,81,74,67]});
        nu.addTuning({name:'GDAD',a:[86,81,74,67]});
        nu.addTuning({name:'Open 5ths',a:[86,79,74,67]});
  		};
  		SEQ.createToolPiano = function(){
  			var nu = this.createToolInstrument('piano','keyboard');

  			nu.eKeyboard = ts.html.nu.ele('ts-keyboard');
  			nu.eKeyboard.style.display = 'block';
  			nu.iSpecific.appendChild(nu.eKeyboard);

  			for (var i = (ts.midi.constant.MIDI_NOTE_MIN+12); i <= (ts.midi.constant.MIDI_NOTE_MAX-24) ; i++){
  				var pad = nu.createPad(i,0);
  				pad.ts.canvas = document.createElement('canvas');
  				pad.ts.canvas.style.width = '0.4em';
  				pad.ts.canvas.style.height = '2em';
  				pad.appendChild(pad.ts.canvas);
  				//string.eEmptyEle.appendChild(string.canvas);
  				//pad.textContent = '!';

  				var note = (pad.ts.note%12);
  				if (note == 1 || note == 3 || note == 6 || note == 8 || note == 10){
  					pad.ts.bgcolor = 'black';
  				}else{
  					pad.ts.bgcolor = 'white';
  				}

  				if (note == 0 || note == 5) pad.ts.borderLeft = true;
  				else pad.ts.borderLeft = false;
  				if (note == 11 || note == 4) pad.ts.borderRight = true;
  				else pad.ts.borderRight = false;

  				nu.eKeyboard.appendChild(pad);
  			}
  			nu.instrumentRefresh = (function(){
  				var running = false;
  				if (ts.player.is.running())running = true;

  				if (zs4.is.array(nu.instrument.ui)){
            //zs4.debug('REFRESHING PIANO running='+running);

  					for (var i=0;i<nu.instrument.ui.length;i++){
  						var pad = nu.instrument.ui[i];


  						var canvas = pad.canvas;
  						var ctx = canvas.getContext("2d");
  						var w = canvas.width;
  						var h = canvas.height;
  						var lw = w/5;
  						//zs4.debug(w,h,pad);

  						ctx.beginPath();
  						ctx.rect(0, 0, w, h);
  			      ctx.fillStyle = pad.bgcolor;
  			      ctx.fill();

  						if (pad.borderLeft){
  							//zs4.debug('BORDERLEFT!!!');
  							ctx.beginPath();
  							ctx.lineWidth = lw;
  							ctx.moveTo(0,0);
  							ctx.lineTo(0,h);
  							ctx.strokeStyle = 'rgba(120,120,120,1)';
  							ctx.stroke();
  						}

  						if (pad.borderRight){
  							//zs4.debug('BORDERLEFT!!!');
  							ctx.beginPath();
  							ctx.lineWidth = lw;
  							ctx.moveTo(w-1,0);
  							ctx.lineTo(w-1,h);
  							ctx.strokeStyle = 'rgba(120,120,120,1)';
  							ctx.stroke();
  						}

  						if (running){
                if (pad.isChordRoot){
                  var rt = h/2;
                  var rh = h - rt;
  								ctx.beginPath();
  								ctx.rect(0, rt, w, rh);
  								ctx.fillStyle = 'rgba(0,128,0,.75)';
  								ctx.fill();
  							}
  							else if (pad.isChordNote){
                  var rt = h*3/4;
                  var rh = h - rt;
  								ctx.beginPath();
                  ctx.rect(0, rt, w, rh);
  								ctx.fillStyle = 'rgba(0,128,0,.75)';
  								ctx.fill();
  							}

                if (pad.isMelodyNote){
                  ctx.beginPath();
  								ctx.rect(0, 0, w, h/3);
  								ctx.fillStyle = 'rgba(255,0,0,1)';
  								ctx.fill();
                }
  						}
  						else {
  							if (pad.isChordRoot){
  								ctx.beginPath();
  								ctx.rect(0, 0, w, h);
  								var grd = ctx.createLinearGradient(0,h,0,h/3);
  								grd.addColorStop(0,'rgba(0,128,0,1)');
  								grd.addColorStop(1,'rgba(0,128,0,0)');
  								ctx.fillStyle = grd;
  								ctx.fill();
  							}
  							else if (pad.isChordNote){
  								ctx.beginPath();
  								ctx.rect(0, 0, w, h);
  								var grd = ctx.createLinearGradient(0,h,0,(h-(h/6)));
  								grd.addColorStop(0,'rgba(0,128,0,1)');
  								grd.addColorStop(1,'rgba(0,128,0,0)');
  								ctx.fillStyle = grd;
  								ctx.fill();
  							}

  							if (pad.isMelodyNote){
  								ctx.beginPath();
  								ctx.rect(0, 0, w, h);
  								var grd = ctx.createLinearGradient(0,0,0,(h-(h/3)));
  								grd.addColorStop(0,'rgba(255,0,0,1)');
  								grd.addColorStop(1,'rgba(255,0,0,0)');
  								ctx.fillStyle = grd;
  								ctx.fill();
  							}

  						}
  					}
  				}
  			});
  			return nu;
  		};

  		SEQ.createToolTranspose = function(){
  			var nu = this.createTool('','transpose');

  			nu.eEventTranspose = ts.html.nu.ele('ts-tool-transpose');
  			nu.eEventTranspose.style.display = 'inline-block';
  			nu.toolWindow.appendChild(nu.eEventTranspose);

  				nu.eEventTransposeLabel = ts.html.nu.ele('ts-tool-transpose-label');
  				nu.eEventTransposeLabel.textContent = 'key:';
  				nu.eEventTranspose.appendChild(nu.eEventTransposeLabel);

  				nu.eEventTransposeSelect = ts.html.nu.ele('select');
  				nu.eEventTransposeSelect.ts = nu;

  					for (var i = 0 ; i < ts.music.NOTES.length ; i++ ){
  						var opt = ts.html.nu.ele('option');
  						opt.value = i;
  						opt.innerHTML = ts.music.NOTES[i].n;
  						nu.eEventTransposeSelect.appendChild(opt);
  					}

  				nu.eEventTransposeSelect.onchange = function(){this.ts.ts.onKeyChange(this.value);};
  				nu.eEventTranspose.appendChild(nu.eEventTransposeSelect);

  			nu.refresh = function(){
  				//zs4.debug('transpose.refresh()');
  				nu.eEventTransposeSelect.value = 0;
  				for (var i = 0; i < this.ts.evt.length; i++){
  					var e = this.ts.evt[i];
  					if (e.chord){
  						nu.eEventTransposeSelect.value = e.chord.v;
  						break;
  					}
  				}
  			};

  			return nu;
  		};
      SEQ.createToolBpm = function(){
  			var nu = this.createTool('bpm','bpm');

  			nu.eEventBpm = ts.html.nu.ele('ts-tool-bpm');
  			nu.eEventBpm.style.display = 'inline-block';
  			nu.toolTitlebar.appendChild(nu.eEventBpm);

  				nu.eEventBpmInput = ts.html.nu.ele('input');
  				nu.eEventBpmInput.type = 'number';
  				nu.eEventBpmInput.value = this.bpm;
  				nu.eEventBpmInput.min = MIN_BEATS_PER_MINUTE;
  				nu.eEventBpmInput.max = MAX_BEATS_PER_MINUTE;
  				nu.eEventBpm.appendChild(nu.eEventBpmInput);
  				nu.eEventBpmInput.ts = nu;
  				nu.eEventBpmInput.onchange = function(){
            this.ts.ts.bpm = parseInt(this.value);
            //if (!SEQ.isPlaying())
            this.ts.ts.refresh();
          };


        nu.eEventBpc = ts.html.nu.ele('ts-tool-bpb');
  			nu.eEventBpc.style.display = 'inline-block';
  			nu.toolTitlebar.appendChild(nu.eEventBpc);

          zs4.admin.util.addIconElement(nu.eEventBpc,'beat')
  				nu.eEventBpcInput = ts.html.nu.ele('input');
  				nu.eEventBpcInput.type = 'number';
  				nu.eEventBpcInput.value = this.bpb;
  				nu.eEventBpcInput.min = MIN_BEATS_PER_BAR;
  				nu.eEventBpcInput.max = MAX_BEATS_PER_BAR;
  				nu.eEventBpc.appendChild(nu.eEventBpcInput);
  				nu.eEventBpcInput.ts = nu;
  				nu.eEventBpcInput.onchange = function(){
  					this.ts.ts.bpb = parseInt(this.value);
            //if (!SEQ.isPlaying())
              this.ts.ts.refresh();
  				};

        nu.eEventTpb = ts.html.nu.ele('ts-tool-tpb');
  			nu.eEventTpb.style.display = 'inline-block';
  			nu.toolTitlebar.appendChild(nu.eEventTpb);


          zs4.admin.util.addIconElement(nu.eEventTpb,'tpb');
  				nu.eEventTpbInput = ts.html.nu.ele('input');
  				nu.eEventTpbInput.type = 'number';
  				nu.eEventTpbInput.value = SEQ.tpb;
  				nu.eEventTpbInput.min = MIN_TICKS_PER_BEAT;
  				nu.eEventTpbInput.max = MAX_TICKS_PER_BEAT;
  				nu.eEventTpb.appendChild(nu.eEventTpbInput);
  				nu.eEventTpbInput.ts = nu;
  				nu.eEventTpbInput.onchange = function(){
            //SEQ.tpb = parseInt(this.value);
            if (!SEQ.isPlaying())
              this.ts.ts.refresh();
          };

  			return nu;
  		};
  		SEQ.createToolMidi = function(){
  			var nu = this.createTool('midi','midi');

  			function addDeviceOptions(){
  				if (ts.playNote == ts.midi.play.note && ts.midi.output.length > 0 && !nu.devices_ok)
  				{
  					nu.eEventMidiDeviceLabel = ts.html.nu.ele('ts-tool-midi-device-label');
  					nu.eEventMidiDeviceLabel.textContent = 'device:';
  					nu.eEventMidiActive.appendChild(nu.eEventMidiDeviceLabel);

  					nu.eEventMidiDevice = ts.html.nu.ele('select');
  					nu.eEventMidiDevice.ts = nu;

  						for (var i = 0 ; i < ts.midi.output.length ; i++ ){
  							var opt = ts.html.nu.ele('option');
  							opt.value = i;
  							opt.innerHTML = ts.midi.output[i].name;
  							nu.eEventMidiDevice.appendChild(opt);
  						}

  					nu.eEventMidiDevice.onchange = function(){nu.ts.ts.midi.current_output = parseInt(this.value);};
  					nu.eEventMidiActive.appendChild(nu.eEventMidiDevice);

  					nu.devices_ok = true;
  				}
  			};

  			nu.devices_ok = false;
  			nu.eEventMidi = ts.html.nu.ele('ts-tool-midi');
  			nu.eEventMidi.style.display = 'inline-block';
  			nu.toolWindow.appendChild(nu.eEventMidi);

  				nu.eEventMidiLabel = ts.html.nu.ele('ts-tool-midi-label');
  				nu.eEventMidiLabel.textContent = 'midi:';
  				nu.eEventMidiLabel.ts = nu;
  				nu.eEventMidiLabel.onclick = function(){
  					this.ts.patchPlayNote();
  					this.ts.ts.refresh();
  				};
  				nu.eEventMidi.appendChild(nu.eEventMidiLabel);

  			nu.patchPlayNote = function(){
  				if (ts.midi.access != null && ts.midi.play.note!=ts.playNote){
  					ts.playNote = ts.midi.play.note;
  				}
  			};


  			nu.eEventMidiActive = ts.html.nu.ele('ts-tool-midi-active');
  			nu.eEventMidiActive.style.display = 'inline-block';
  			nu.eEventMidi.appendChild(nu.eEventMidiActive);

  			nu.refresh = function(){

  				addDeviceOptions();

  				this.eEventMidiLabel.className = '';
  				if (ts.midi.access == null){
  					this.eEventMidiLabel.className = 'tserror';
  					nu.eEventMidiLabel.textContent = 'midi: not available';
  					nu.eEventMidiActive.style.display = 'none'

  				}else if (ts.midi.play.note==ts.playNote){
  					nu.eEventMidiLabel.textContent = 'midi: is active';
  					nu.eEventMidiActive.style.display = 'inline-block'

  				}else{
  					nu.eEventMidiLabel.textContent = 'click to activate midi';
  					nu.eEventMidiActive.style.display = 'none'
  				}

  			};

  			return nu;
  		};
  		SEQ.createToolAudio = function(){
  			var nu = this.createTool('audio','audio');

  			nu.eEventAudio = ts.html.nu.ele('ts-tool-audio');
  			nu.eEventAudio.style.display = 'inline-block';
  			nu.toolWindow.appendChild(nu.eEventAudio);

  				nu.eEventAudioLabel = ts.html.nu.ele('ts-tool-audio-label');
  				nu.eEventAudioLabel.textContent = 'audio:';
  				nu.eEventAudioLabel.ts = nu;
  				nu.eEventAudioLabel.onclick = function(){
  					this.ts.patchPlayNote();
  					this.ts.ts.refresh();
  				};
  				nu.eEventAudio.appendChild(nu.eEventAudioLabel);

  			nu.patchPlayNote = function(){
  				if (ts.audio.context != null && ts.audio.play.note!=ts.playNote){
  					ts.playNote = ts.audio.play.note;
  				}
  			};

  			nu.refresh = function(){
  				this.eEventAudioLabel.className = '';
  				if (ts.audio.context == null){
  					this.eEventAudioLabel.className = 'tserror';
  					nu.eEventAudioLabel.textContent = 'audio: not available';
  				}else if (ts.audio.play.note==ts.playNote){
  					nu.eEventAudioLabel.textContent = 'audio: is active';
  				}else{
  					nu.eEventAudioLabel.textContent = 'click to activate audio';
  				}

  			};

  			return nu;
  		};
  		SEQ.createToolBars = function(){
  			var nu = this.createTool('bars','bars');

  			nu.eEventBarButton = ts.html.nu.ele('ts-tool-bar-button');
  			nu.eEventBarButton.ts = nu;
  			nu.eEventBarButton.onclick = function(){
  				var e = this.ts.toggleBar();
  				if (e.bar && e.beat) zs4.admin.util.setIcon(nu.eEventBarButton,'bars');
  				else if (e.beat) zs4.admin.util.setIcon(nu.eEventBarButton,'beats');
  				else zs4.admin.util.setIcon(nu.eEventBarButton,'plus');
  				this.ts.ts.refresh();
  			};
  			nu.toolTitlebar.appendChild(nu.eEventBarButton);

  			nu.refresh = function(){
  				if (this.ts.evt_current != null){
  					var e = this.ts.evt_current;
  					if (e.bar){
  						zs4.admin.util.setIcon(nu.eEventBarButton,'bars');
  					}
  					else if (e.beat){
  						zs4.admin.util.setIcon(nu.eEventBarButton,'beats');
  					}
  					else {
  						zs4.admin.util.setIcon(nu.eEventBarButton,'plus');
  					}
  				}
  			};

  			return nu;
  		};
  		SEQ.createToolBeats = function(){
  			var nu = this.createTool('beats','beats');

  			nu.eEventBeatButton = ts.html.nu.ele('ts-tool-beat-button');
  			nu.eEventBeatButton.ts = nu;
  			nu.eEventBeatButton.onclick = function(){
  				//alert('add chord');
  				this.ts.toggleBeat();
  				this.ts.ts.refresh();
  			};
  			nu.toolTitlebar.appendChild(nu.eEventBeatButton);

  			nu.refresh = function(){
  				if (this.ts.evt_current != null){
  					var e = this.ts.evt_current;
  					if (e.bar){
  						zs4.admin.util.setIcon(nu.eEventBeatButton,'bars');
  					}
  					else if (e.beat){
  						zs4.admin.util.setIcon(nu.eEventBeatButton,'beats');
  					}
  					else {
  						zs4.admin.util.setIcon(nu.eEventBeatButton,'plus');
  					}
  				}
  			};

  			return nu;
  		};
  		SEQ.createToolChord = function(){
  			var nu = this.createTool('chord','chord');

  			nu.eEventChord = ts.html.nu.ele('ts-tool-chord');
  			nu.eEventChord.style.display = 'inline-block';
  			nu.toolTitlebar.appendChild(nu.eEventChord);

  				nu.eEventChordAdd = ts.html.nu.ele('ts-tool-chord-add');
  				nu.eEventChordAdd.ts = nu;
  				nu.eEventChordAdd.onclick = function(){
  					//alert('add chord');
  					this.ts.setCurrentChordRoot(0);
  					this.ts.ts.refresh();
  				};
  				zs4.admin.util.setIcon(nu.eEventChordAdd,'plus');
  				nu.eEventChord.appendChild(nu.eEventChordAdd);

  				nu.eEventChordNote = ts.html.nu.ele('select');
  				nu.eEventChordNote.ts = nu;
  				nu.eEventChord.appendChild(nu.eEventChordNote);
  					for (var i = 0 ; i < ts.music.NOTES.length ; i++ ){
  						var opt = ts.html.nu.ele('option');
  						opt.value = i;
  						opt.innerHTML = ts.music.NOTES[i].s;
  						nu.eEventChordNote.appendChild(opt);
  					}
  				nu.eEventChordNote.onchange = function(){
  					this.ts.setCurrentChordRoot(this.value);
  					this.ts.ts.refresh();
  				};

  				nu.eEventChordType = ts.html.nu.ele('select');
  				nu.eEventChordType.ts = nu;
  				nu.eEventChord.appendChild(nu.eEventChordType);

  					for (var i = 0 ; i < ts.music.CHORD.TYPE.length ; i++ ){
  						var opt = ts.html.nu.ele('option');
  						opt.value = i;
  						opt.innerHTML = ts.music.CHORD.TYPE[i].s;
  						nu.eEventChordType.appendChild(opt);
  					}
  				nu.eEventChordType.onchange = function(){
  					this.ts.setCurrentChordType(this.value);
  					this.ts.ts.refresh();
  				};

  				nu.eEventChordSlash = ts.html.nu.ele('ts-chord-slash');
  				nu.eEventChordSlash.ts = nu;
  				nu.eEventChord.appendChild(nu.eEventChordSlash);

  				nu.eEventChordBass = ts.html.nu.ele('select');
  				nu.eEventChordBass.ts = nu;
  				nu.eEventChord.appendChild(nu.eEventChordBass);

  					for (var i = 0 ; i < ts.music.NOTES.length ; i++ ){
  						var opt = ts.html.nu.ele('option');
  						opt.value = i;
  						opt.innerHTML = ts.music.NOTES[i].s;
  						nu.eEventChordBass.appendChild(opt);
  					}
  				nu.eEventChordBass.onchange = function(){
  					this.ts.setCurrentChordBass(this.value);
  					this.ts.ts.refresh();
  				};


  				//nu.eEventChordType.onchange = function(){this.ts.onKeyChange();};
  				nu.eEventChordDelete = ts.html.nu.ele('ts-event-chord-delete');
  				nu.eEventChordDelete.textContent = 'X';
  				nu.eEventChordDelete.ts = nu;
  				nu.eEventChordDelete.onclick = function(){
  					this.ts.deleteCurrentChord();
  					this.ts.ts.refresh();
  				};
  				nu.eEventChord.appendChild(nu.eEventChordDelete);

  			nu.refresh = function(){
  				if (this.ts.evt_current != null){
  					var e = this.ts.evt_current;
  					if (e.chord != null){
  						this.eEventChordAdd.style.display = 'none';
  						this.eEventChordNote.style.display = 'inline'
  						this.eEventChordType.style.display = 'inline'
  						this.eEventChordSlash.style.display = 'inline'
  						this.eEventChordBass.style.display = 'inline'
  						this.eEventChordDelete.style.display = 'inline'

  						this.eEventChordNote.value = e.chord.v;
  						this.eEventChordType.value = e.chord.t;
  						this.eEventChordBass.value = e.chord.b;
  						//alert('chord found!');
  					}
  					else {
  						this.eEventChordAdd.style.display = 'inline';
  						this.eEventChordNote.style.display = 'none'
  						this.eEventChordType.style.display = 'none'
  						this.eEventChordSlash.style.display = 'none'
  						this.eEventChordBass.style.display = 'none'
  						this.eEventChordDelete.style.display = 'none'

  						//alert('no chord!');
  					}
  				}
  			};

  			return nu;
  		};
  		SEQ.createToolScript = function(){
  			var nu = this.createTool('script','document');

  			nu.eTextArea = ts.html.nu.ele('textarea');
  			nu.eTextArea.style.width = '100%';
  			nu.eTextArea.style.maxWidth = '100%';
  			nu.eTextArea.style.minWidth = '100%';
  			nu.eTextArea.style.height = 'auto';
  			nu.eTextArea.onchange = function(){
  				nu.ts.clear();
  		    nu.ts.runChordsAndLyrics(nu.eTextArea.value);
  				nu.ts.current_tool = null;
  				nu.ts.hideAllToolPanes();
  			};
  			nu.toolWindow.appendChild(nu.eTextArea);

  			nu.onactivate = function(){
  				nu.eTextArea.value = nu.ts.getChordsAndLyrics();
  			};
  			nu.refresh = function(){};

  		};
      SEQ.createToolAbc = function(){
  			var nu = this.createTool('abc','abc');

        var go = zs4.admin.util.addIconElement(nu.toolTitlebar,'toonsmith');
        go.onclick = function(){
          if (nu.eTextArea.value=='')return;
          var parsed = SEQ.runABC(nu.eTextArea.value);
          nu.ts.clear();
  		    nu.ts.runChordsAndLyrics(parsed);
  				//nu.ts.current_tool = null;
  				//nu.ts.hideAllToolPanes();
        }

  			nu.eTextArea = ts.html.nu.ele('textarea');
  			nu.eTextArea.style.width = '100%';
  			nu.eTextArea.style.maxWidth = '100%';
  			nu.eTextArea.style.minWidth = '100%';
  			nu.eTextArea.style.height = 'auto';
        nu.toolWindow.appendChild(nu.eTextArea);

  		};
  		SEQ.createToolLayout = function(){
  			var nu = this.createTool('layout','layout');

  			nu.lfLabel =  ts.html.nu.ele('ts-input-label');
  			nu.lfLabel.innerHTML =  '&#xb6;';
  			//zs4.admin.util.setIcon(nu.lfLabel,'pilcrow');
  			nu.toolTitlebar.appendChild(nu.lfLabel);

  			nu.eLineFeed = ts.html.nu.ele('input');
  			nu.eLineFeed.type = 'checkbox';
  			nu.eLineFeed.checked = true;
  			nu.eLineFeed.name = '&#xb6;';
  			nu.eLineFeed.style.display = 'inline-block';
  			nu.eLineFeed.onclick = function(){
          if (nu.eLineFeed.checked)SEQ.layoutlinefeed=true;
          else SEQ.layoutlinefeed=false;
          SEQ.refreshLineFeed();
  				var arr = nu.ts.evt;
  			};
  			nu.toolTitlebar.appendChild(nu.eLineFeed);

  			return nu;
  		};
      SEQ.createToolEvent = function(){
  			var TOOL = this.createTool('event','event');

        TOOL.eLabel = document.createElement('ts-label');
        TOOL.toolTitlebar.appendChild(TOOL.eLabel);

        TOOL.eDetail = document.createElement('ts-event-detail');
        TOOL.eDetail.style.display = 'none';
        TOOL.toolWindow.appendChild(TOOL.eDetail);

        TOOL.data = new Object({});

        var table = function(name){
          var TABLE = this;
          TOOL.data[name] = TABLE;

          TABLE.e = document.createElement('table');
          TABLE.e.width = '100%';
          TOOL.eDetail.appendChild(TABLE.e);

          TABLE.row = function(name){
            var ROW = this;
            TABLE[name] = ROW;

            ROW.name = name;

            ROW.e = document.createElement('tr');
            TABLE.e.appendChild(ROW.e);

            ROW.t = new Object();
            ROW.t.e = document.createElement('td');
            ROW.t.e.textContent = name;
            ROW.t.e.width = '25%';
            ROW.t.e.style.textAlign = 'right';
            ROW.e.appendChild(ROW.t.e);

            ROW.p = new Object();
            ROW.p.e = document.createElement('td');
            ROW.p.e.style.textAlign = 'right';
            ROW.e.appendChild(ROW.p.e);

            ROW.c = new Object();
            ROW.c.e = document.createElement('td');
            ROW.c.e.style.textAlign = 'center';
            ROW.e.appendChild(ROW.c.e);

            ROW.n = new Object();
            ROW.n.e = document.createElement('td');
            ROW.c.e.style.textAlign = 'left';
            ROW.e.appendChild(ROW.n.e);

            ROW.addIcons = function(name){
              ROW.p.icon = zs4.admin.util.addIconElement(ROW.p.e,'prev');
              ROW.p.icon.onclick = SEQ.setPreviousEvent;

              ROW.c.icon = zs4.admin.util.addIconElement(ROW.c.e,name);

              ROW.n.icon = zs4.admin.util.addIconElement(ROW.n.e,'next');
              ROW.n.icon.onclick = SEQ.setNextEvent;
            }
          };

          var head = new TABLE.row('head');
          //head.t.e.innerHTML = '<b>'+name+'</b>';
          head.t.e.textContent = name;
          head.t.e.style.fontWeight = 'bolder';
          head.t.e.style.textAlign = 'left';

          head.addIcons(name);

          return TOOL.data[name];
        }

        new table('event');

        var bar = new table('bar');
        bar.head.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevBar(SEQ.evt_curidx)]);
        };
        bar.head.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextBar(SEQ.evt_curidx)]);
        };

        var beat = new table('beat');
        beat.head.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevBeat(SEQ.evt_curidx)]);
        };
        beat.head.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextBeat(SEQ.evt_curidx)]);
        };

        var chord = new table('chord');
        chord.head.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevChord(SEQ.evt_curidx)]);
        };
        chord.head.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextChord(SEQ.evt_curidx)]);
        };

        var note = new table('note');
        note.head.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevNote(SEQ.evt_curidx)]);
        };
        note.head.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextNote(SEQ.evt_curidx)]);
        };

        var lyric = new table('lyric');
        lyric.head.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevLyric(SEQ.evt_curidx)]);
        };
        lyric.head.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextLyric(SEQ.evt_curidx)]);
        };
        var space = new lyric.row('space');
        space.addIcons('space');
        space.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevSpace(SEQ.evt_curidx)]);
        };
        space.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextSpace(SEQ.evt_curidx)]);
        };
        var linefeed = new lyric.row('linefeed');
        linefeed.addIcons('linefeed');
        linefeed.p.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchPrevLinefeed(SEQ.evt_curidx)]);
        };
        linefeed.n.icon.onclick = function(){
          SEQ.setCurrentEvent(SEQ.evt[SEQ.searchNextLinefeed(SEQ.evt_curidx)]);
        };

        //zs4.debug(space);


        TOOL.refresh = function(){
  				if (this.ts.evt_current != null){
            // UPDATE LABEL
            TOOL.eLabel.textContent =
            'Event: #'
            +SEQ.evt_curidx
            +' of '
            +SEQ.evt.length;

            TOOL.eDetail.style.display = 'block';
          }
          else {
            // UPDATE LABEL
            TOOL.eLabel.textContent = 'No events exist in this project';
            TOOL.eDetail.style.display = 'none';
          }

  			};
  			return TOOL;
  		};

  		SEQ.createColon = function(){
  			var nu = ts.html.nu.ele('ts-colon');
  			nu.textContent = ':';
  			return nu;
  		};

			SEQ.stsElement = ts.html.nu.ele('ts-statusbar');
			SEQ.stsElement.style.display = 'block';
			ele.appendChild(SEQ.stsElement);

				SEQ.stsEvents = ts.html.nu.ele('ts-count-events');
				SEQ.stsElement.appendChild(SEQ.stsEvents);

				SEQ.stsChords = ts.html.nu.ele('ts-count-chords');
				SEQ.stsElement.appendChild(SEQ.stsChords);

				SEQ.stsBars = ts.html.nu.ele('ts-count-bars');
				SEQ.stsBars.className = 'tsbar';
				SEQ.stsElement.appendChild(SEQ.stsBars);

				SEQ.stsBeats = ts.html.nu.ele('ts-count-beat');
				SEQ.stsBeats.className = 'tsbeat';
				SEQ.stsElement.appendChild(SEQ.stsBeats);

				SEQ.stsNotes = ts.html.nu.ele('ts-count-notes');
				SEQ.stsNotes.className = 'tsnote';
				SEQ.stsElement.appendChild(SEQ.stsNotes);

			SEQ.hideAllInstPanes = function(){
				SEQ.current_inst = null;
				for (var i = 0; i < SEQ.inst.length; i++){
					SEQ.inst[i].toolWindow.style.display = 'none';
					SEQ.inst[i].visible = false;
				}
        SEQ.adaptContentPane();
        SEQ.kb.refresh();
			};
			SEQ.hideAllToolPanes = function(){
				SEQ.current_tool = null;
				for (var i = 0; i < SEQ.tool.length; i++){
					SEQ.tool[i].toolWindow.style.display = 'none';
					SEQ.tool[i].visible = false;
				}
        SEQ.adaptContentPane();
        SEQ.kb.refresh();
			};

			SEQ.createToolChord();
			SEQ.createToolGuitar();
			SEQ.createToolPiano();
			SEQ.createToolUkulele();
			SEQ.createToolMandolin();

			SEQ.createToolViolin();
			SEQ.createToolBass();

      SEQ.createToolScript();
      SEQ.createToolAbc();
			SEQ.createToolBars();
			SEQ.createToolBeats();
      SEQ.bpmTool = SEQ.createToolBpm();
			SEQ.createToolTranspose();
			SEQ.createToolAudio();
			SEQ.createToolMidi();
      SEQ.createToolLayout();
      SEQ.createToolEvent();
			return ts.ts = SEQ;
		}
	},
	nu:{
		ele:function(nam){
			var nu = document.createElement(nam);
			return nu;
		},
		err:function(val){
			var nu = ts.html.nu.ele('ts-error');
			nu.textContent = val;
			return nu;
		},
	},
	get:{
		id:function(id){
			return document.getElementById(id);
		},
		plain:function(f){
			var t = "";
			if (!zs4.is.string(f)) return t;
			var last_ch = ' ';
			var last_ch_was_space = true;
			var lessening = false;
			var o = 0;
			for (var i = 0 ; i < f.length ; i++){
				var cur_ch = f.charAt(i);
				if (cur_ch=='<') {lessening=true; continue;}
				if (cur_ch=='>') {lessening=false; continue;}
				if (lessening||cur_ch=='\t'||cur_ch=='\r')continue;

				if (cur_ch=='\n'){if (o==0||i==(f.length-1))continue; t += cur_ch.toString();o++;last_ch_was_space=false;continue;}

				if (zs4.is.space(cur_ch)){
					if (last_ch_was_space)continue;
					t += " "; o++;
					last_ch_was_space = true;
					continue;
				}
				last_ch_was_space = false;
				t += cur_ch.toString();
				o++;
			}
			return t.trim();
		}
	},
});

ts.midi = new Object({
	access:null,
	initialized:false,
	input:[],
	output:[],
	current_output:0,
	status:{
		onMIDISuccess:function(midiAccess) {
			ts.midi.access = midiAccess;
			ts.midi.initialized = true;

			try {

				//zs4.debug('testing ts.midi.access');
				//zs4.debug(ts.midi.access);
				for (var entry in ts.midi.access.inputs) {
					ts.midi.input.push(entry[1]);
				}

				for (var entry in ts.midi.access.outputs) {
					ts.midi.output.push(entry[1]);
				}
			} catch(e){}

		},

		onMIDIFailure:function(e) {
			ts.midi.access = null;
			ts.midi.initialized = false;
		},
	},
	initialize:function(){
		if (ts.midi.initialized)
			return ts.midi.access;

		ts.midi.initialized = true;
		if (navigator.requestMIDIAccess) {
			navigator.requestMIDIAccess({
				sysex: false // this defaults to 'false' and we won't be covering sysex in this article.
			}).then(ts.midi.status.onMIDISuccess, ts.midi.status.onMIDIFailure);
		} else {
			ts.midi.initialized = false;
			ts.midi.access = null;
		}
		return ts.midi.access;
	},
	constant:{
		A4_NOTE:69,
		MIDI_NOTE_MIN:21,
		MIDI_NOTE_MAX:108,
		MIDDLE_C:60,
	},
	play:{
		note:function(channel,note,volume,millies){

			var noteOnMessage = [0x90|(channel&0xf), (note&0x7f), (volume&0x7f)];    // note on, middle C, full velocity
			var noteOffMessage = [0x80|(channel&0xf), (note&0x7f), 0x40];    // note off, middle C, full velocity
			var output = ts.midi.output[ts.midi.current_output];
			output.send( noteOnMessage );  //omitting the timestamp means send immediately.
			output.send( noteOffMessage, window.performance.now() + millies );
		},
	},
});

ts.audio = new Object({
	context:null,
	create:{
		node:function(obj){
      const AUDIO = ts.audio;
      const CTX = AUDIO.context;
      const NODE = this;
      if (obj==null){
        NODE.name = 'master';
        NODE.object = CTX;
        NODE.volume = CTX.createGain();
        NODE.volume.connect(CTX.destination);
        NODE.volume.gain.value = 0.2;
        NODE.destination = NODE.volume;
        AUDIO.master = NODE;
      }
      NODE.oscillator = function(obj){
        const OSC = this;
        OSC.name = obj.name;
        OSC.object = CTX.createOscillator();
        OSC.noteAtTime = function(note,t){
          if(t==null)t=CTX.currentTime;
          else t=CTX.currentTime+(t/1000);
          OSC.object.frequency.setValueAtTime(
            (440 * Math.pow(2.0,((note-ts.midi.constant.A4_NOTE)/12.0))),
          t);
        };
        OSC.volume = CTX.createGain();
        OSC.volume.connect(NODE.destination);
        OSC.volume.gain.setValueAtTime(1.0,CTX.currentTime);
        OSC.adsr = CTX.createGain();
        OSC.adsr.gain.value = 0;
        OSC.adsr.connect(OSC.volume);
        OSC.adsr.gain.setValueAtTime(0.0,CTX.currentTime);
        OSC.fadeToBy = function(g,t,d){
          if(t==null)t=CTX.currentTime;
          else t=CTX.currentTime+(t/1000);
          OSC.adsr.gain.setTargetAtTime(g,t,d/1000);
        };
        OSC.object.connect(OSC.adsr);
        AUDIO.master[OSC.name] = OSC;
        OSC.object.start();
      }
		},
	},
	initialized:false,
	initialize:function(){
		if (ts.audio.initialized)
			return true;

		if (typeof window.AudioContext === "function"){
			ts.audio.context = new window.AudioContext();
		} else if (typeof window.webkitAudioContext === "function"){
			ts.audio.context = new window.webkitAudioContext();
		}

		if (ts.audio.context == null)
			return false;

    ts.audio.create.node(null);
    ts.audio.ui = new ts.audio.master.oscillator({name:'ui'});
		ts.audio.initialized = true;
		return true;
	},
	play:{
		note:function(channel,note,volume,duration){
      //duration = 2000;
      var oscillator = ts.audio.master.ui;
      var velocity = volume/128;
      var AR = ts.player.internal.ATTACKRELEASE;
      if (duration < (AR*2)) AR = duration/2;
      var start = 0;//Date.now();
      oscillator.noteAtTime(note,0);
      oscillator.fadeToBy(velocity,0,AR);
      oscillator.fadeToBy(0,AR,duration-AR);
		},
	},

});
