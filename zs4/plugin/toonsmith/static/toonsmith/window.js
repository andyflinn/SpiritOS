'use strict';

var ts;

if (true){
  var isWindow = new Function("try {return this===window;}catch(e){ return false;}");
  var isNode = new Function("try {return this===global;}catch(e){return false;}");

  if (isNode()) {
      ts = exports;
      ts.is = new Object({
        window:function(){return false;},
        node:function(){return true;},
      });
      ts.zs4 = require('../../../../static/zs4.js');
      ts.debug = require('debug')('zs4ts');

  }
  else {
      ts = new Object({
        is:{
          window:function(){return true;},
          node:function(){return false;},
        },
      });
      ts.zs4 = zs4;
      ts.debug = console.log;
  }
}

ts.create = function(){
    var SEQUENCE = this;

		SEQUENCE.ts = ts;
		SEQUENCE.arg = new Object({});
		SEQUENCE.evt = new Array();
		SEQUENCE.tool = new Array();
		SEQUENCE.inst = new Array();
		SEQUENCE.toolobject = new Object({});
		SEQUENCE.instobject = new Object({});
		SEQUENCE.bpb = 4;
		SEQUENCE.bpm = 120;
		SEQUENCE.tpb = 3;
    SEQUENCE.layoutlinefeed = true;
		SEQUENCE.stats = new Object({
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


			currentBar:null,
			currentBeat:null,
			start:function(){
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

				if (e.chord != null && e.chord.ok){
					STATS.countChords++;
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

				if (e.melody != 0){
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
				this.chords = this.countChords;
				this.bars = this.countBars;
				this.beats = this.countBeats;
        this.notes = this.countNotes;
        this.lyric = this.countLyric;
        this.linefeed = this.countLinefeed;
        this.space = this.countSpace;

        this.result = new Object();

        if (this.chords==0 && this.notes==0)this.result.tone = false;
        else this.result.tone = true;

        if (this.bars==0&&this.beats==0)this.result.time = false;
        else this.result.time = true;

        if (!this.result.time && !this.result.tone) this.result.music = false;
        else  this.result.music = true;

        if (this.lyric == 0)this.result.words = false;
        else this.result.words = true;
			},
		});
		SEQUENCE.key = ts.music.parse.chord("");
		SEQUENCE.evt_current = null;
		SEQUENCE.evt_curidx = -1;
		SEQUENCE.evt_shown = null;
		SEQUENCE.current_tool = null;
		SEQUENCE.current_inst = null;

		SEQUENCE.onKeyChange = function(nuKee){
			if	(!this.key.ok)
				return;

			nuKee = parseInt(nuKee);

			var delta = nuKee - this.key.v;
			this.key.v = nuKee;

			this.transpose(delta);
		};
		SEQUENCE.showEventAsCurrent = function(e){
      if (!ts.is.window())return null;
			if ( this.evt_shown != null ){
				this.evt_shown.className = '';
			}

			if (e == null){
				return null;
			}

			this.evt_shown = e.eSpan;
			this.evt_shown.className = 'tscurrent';
			return e;
		};
		SEQUENCE.setCurrentEvent = function(evt){
			var playing = ts.player.is.running();

			SEQUENCE.evt_current = evt;
			if (!playing){
				if (ts.is.window())SEQUENCE.showEventAsCurrent(evt);
			}

			SEQUENCE.evt_curidx = -1;
			for (var i = 0 ; i < this.evt.length ; i++){
				if (evt == SEQUENCE.evt[i]){
					SEQUENCE.evt_curidx = i;
					break;
				}
			}

			if (SEQUENCE.current_tool != null && !playing){
				SEQUENCE.current_tool.refresh();
			}
			if (SEQUENCE.current_inst != null && !playing){
				SEQUENCE.current_inst.refresh();
			}

		};
		SEQUENCE.getEventIndex = function(evt){
			for (var i = 0 ; i < SEQUENCE.evt.length ; i++){
				if (evt == SEQUENCE.evt[i])
				return i;
			}

			return 0;
		};
		SEQUENCE.setNextEvent = function(){
			SEQUENCE.setCurrentEvent(SEQUENCE.evt[((SEQUENCE.evt_curidx+1) % SEQUENCE.evt.length)]);
		};
		SEQUENCE.setPreviousEvent = function(){
			SEQUENCE.setCurrentEvent(SEQUENCE.evt[((SEQUENCE.evt_curidx+SEQUENCE.evt.length-1) % SEQUENCE.evt.length)]);
		};

    SEQUENCE.searchNextEvent = function(from,testEvent){
      if (SEQUENCE.evt.length==0)return from;
      if (!zs4.is.function(testEvent))return ((SEQUENCE.evt_curidx+1) % SEQUENCE.evt.length);
      var start = from;
			if (start == null) start = SEQUENCE.evt_curidx;
			start %= SEQUENCE.evt.length;
			start += SEQUENCE.evt.length;

			for (var i = 0 ; i < SEQUENCE.evt.length ; i++){
				start++;
				var idx = (start%SEQUENCE.evt.length);
				if (testEvent(SEQUENCE.evt[idx]))
					return idx;
			}

			return from;
		};
		SEQUENCE.searchPrevEvent = function(from,testEvent){
      if (SEQUENCE.evt.length==0)return from;
			if (!zs4.is.function(testEvent))return ((SEQUENCE.evt_curidx+SEQUENCE.evt.length-1) % SEQUENCE.evt.length);
      var start = from;
			if (start == null) start = SEQUENCE.evt_curidx;
			start %= SEQUENCE.evt.length;
			start += SEQUENCE.evt.length;

			for (var i = 0 ; i < this.evt.length ; i++){
				start--;
				var idx = (start%SEQUENCE.evt.length);
        if (testEvent(SEQUENCE.evt[idx]))
					return idx;
			}

			return from;
		};
		SEQUENCE.searchPrevBar = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){if (evt.bar)return true; return false});
		};
		SEQUENCE.searchNextBar = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){if (evt.bar)return true; return false});
		};
    SEQUENCE.searchPrevBeat = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){if (evt.beat)return true; return false});
		};
		SEQUENCE.searchNextBeat = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){if (evt.beat)return true; return false});
		};
    SEQUENCE.searchPrevChord = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){
        if (zs4.is.object(evt.chord)&&evt.chord.ok)return true; return false
      });
		};
		SEQUENCE.searchNextChord = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){
        if (zs4.is.object(evt.chord)&&evt.chord.ok)return true; return false
      });
		};
    SEQUENCE.searchPrevNote = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){
        if (evt.melody!=0)return true; return false
      });
		};
		SEQUENCE.searchNextNote = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){
        if (evt.melody!=0)return true; return false
      });
		};
    SEQUENCE.searchPrevLyric = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){
        if (evt.lyric.trim()!='')return true; return false
      });
		};
		SEQUENCE.searchNextLyric = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){
        if (evt.lyric.trim()!='')return true; return false
      });
		};
    SEQUENCE.searchPrevSpace = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){
        if (evt.space)return true; return false
      });
		};
		SEQUENCE.searchNextSpace = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){
        if (evt.space)return true; return false
      });
		};
    SEQUENCE.searchPrevLinefeed = function(from){
      return SEQUENCE.searchPrevEvent(from,function(evt){
        if (evt.linefeed)return true; return false
      });
		};
		SEQUENCE.searchNextLinefeed = function(from){
      return SEQUENCE.searchNextEvent(from,function(evt){
        if (evt.linefeed)return true; return false
      });
		};
		SEQUENCE.searchActiveChord = function(from){
			if (SEQUENCE.evt.length == 0 || SEQUENCE.evt_current == null)
				return null;

			if (SEQUENCE.evt_current.chord)
				return SEQUENCE.evt_current.chord;

			for (var i = (SEQUENCE.evt.length-1) ; i > 0; i--){
				var idx = ((SEQUENCE.evt_curidx+i)%SEQUENCE.evt.length);
				if (SEQUENCE.evt[idx].chord)
					return SEQUENCE.evt[idx].chord;
			}

			return from;
		};
		SEQUENCE.transpose = function(delta){

			for ( var i = 0 ; i < SEQUENCE.evt.length ; i++ ){
				var evt = SEQUENCE.evt[i];
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
		SEQUENCE.updateStats = function(){
			SEQUENCE.stats.start();
			for ( var i = 0 ; i < SEQUENCE.evt.length ; i++ ){
				SEQUENCE.evt[i].duration = 0;
				SEQUENCE.evt[i].refresh();
				SEQUENCE.stats.countEvent(SEQUENCE.evt[i]);
			}
			SEQUENCE.stats.end();

      if (SEQUENCE.evt.length > 0){

        var bar = null, beat = null, chord = null, melody = null, text = null;
        for ( var idx = 0 ; idx <= (SEQUENCE.evt.length+1); idx++){
          var i = idx % SEQUENCE.evt.length;
          var e = SEQUENCE.evt[i];
          if (e.isBar()){if (bar!=null) e.prevBar = bar; bar = e; }
          if (e.isBeat()){if (beat!=null) e.prevBeat = beat; beat = e; }
          if (e.isChord()){if (chord!=null) e.prevChord = chord; chord = e; }
          if (e.isMelody()){if (melody!=null) e.prevMelody = melody; melody = e; }
          if (e.isLyric()||e.isSpace()){if (text!=null) e.prevText = text; text = e; }
        }

        bar = null; beat = null; chord = null; melody = null; text = null;
        for ( var idx = SEQUENCE.evt.length ; idx >= 0; idx--){
          var i = idx % SEQUENCE.evt.length;
          var e = SEQUENCE.evt[i];
          if (e.isBar()){if (bar!=null) e.nextBar = bar; bar = e; }
          if (e.isBeat()){if (beat!=null) e.nextBeat = beat; beat = e; }
          if (e.isChord()){if (chord!=null) e.nextChord = chord; chord = e; }
          if (e.isMelody()){if (melody!=null) e.nextMelody = melody; melody = e; }
          if (e.isLyric()||e.isSpace()){if (text!=null) e.nextText = text; text = e; }
        }

      }

		};
		SEQUENCE.recomputeTiming = function(){
			SEQUENCE.updateStats();
			var seq = SEQUENCE;
			SEQUENCE.barTotalMillies = Math.round(SEQUENCE.bpb * (60000/SEQUENCE.bpm));
      SEQUENCE.beatMillies = Math.round(SEQUENCE.barTotalMillies/SEQUENCE.bpb);
      SEQUENCE.barTicks = Math.round(SEQUENCE.bpb*SEQUENCE.tpb);
      SEQUENCE.tickMillies = Math.round(SEQUENCE.barTotalMillies/SEQUENCE.barTicks);
      while ((SEQUENCE.tickMillies*SEQUENCE.barTicks)<SEQUENCE.barTotalMillies)SEQUENCE.tickMillies += 1;

      ts.debug('SEQUENCE.barTotalMillies='+SEQUENCE.barTotalMillies);
      ts.debug('SEQUENCE.beatMillies='+SEQUENCE.beatMillies);
      ts.debug('SEQUENCE.barTicks='+SEQUENCE.barTicks);
      ts.debug('SEQUENCE.tickMillies='+SEQUENCE.tickMillies);

			var title = '';

			function processBeat(beat,no,length){

				var tit = 'beat:'+ (no+1) +' length:'+length;
				if (SEQUENCE.evt[beat].bar==null && SEQUENCE.evt[beat].beat!=null){
					if (ts.is.window())SEQUENCE.evt[beat].eBlockChart.title = tit;
				}
				SEQUENCE.evt[beat].duration = length;

				//if (seq.evt[beat].beat==null)ts.debug('beat with no beat');
				// count beat events
				var eCount = 0;
				for (var c = beat ; c < (beat+SEQUENCE.evt.length); c++){
					var ci = (c+SEQUENCE.evt.length)%SEQUENCE.evt.length;

					if (SEQUENCE.evt[ci].hasMusic()) eCount++;

					// loop control
					ci = (ci+1+SEQUENCE.evt.length)%SEQUENCE.evt.length;
					if (SEQUENCE.evt[ci].beat) break;
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

			if (SEQUENCE.stats.bars > 0){
				var cur_bar = SEQUENCE.searchNextBar(this.evt.length-1);
				var countObject = new Object({
					events:0,
					beats:0,
          notes:0,
          chords:0,
				});

				for (var b = 0; b < SEQUENCE.stats.bars; b++){
					title = 'bar '+(b+1)+' ';
					var beatNo = 0;

					// count beats and events in current bar
					countObject.events = countObject.beats = countObject.notes = countObject.chords = 0;
					for (var c = cur_bar ; c < (cur_bar+SEQUENCE.evt.length); c++){
						var ci = (c+SEQUENCE.evt.length)%SEQUENCE.evt.length;
						countObject.events++;
						if (SEQUENCE.evt[ci].isBeat()) countObject.beats++;
            if (SEQUENCE.evt[ci].isMelody()) countObject.notes++;
            if (SEQUENCE.evt[ci].isChord()) countObject.chords++;

						// loop control
						ci = (ci+1+SEQUENCE.evt.length)%SEQUENCE.evt.length;
						if (SEQUENCE.evt[ci].bar) break;
					}
					title += ' beats:'+countObject.beats
                +' events:'+countObject.events
                +' notes:'+countObject.notes
								+' chords:'+countObject.chords;

					if (countObject.beats == this.bpb){
						beatNo = 0;
						for (var c = cur_bar ; c < (cur_bar+SEQUENCE.evt.length); c++){
							var ci = (c+this.evt.length)%this.evt.length;
							if (this.evt[ci].isBar()&&ci!=cur_bar)break;
							if (this.evt[ci].isBeat()) {
								if (beatNo==0) {title += ' length:'+SEQUENCE.beatMillies;}
								processBeat(ci,beatNo,SEQUENCE.beatMillies);
								beatNo += 1;
							}
						}
					}
					else {
						var bMils = SEQUENCE.beatMillies;
						var couBeats = countObject.beats;
						var bpb = SEQUENCE.bpb;

						while (couBeats>bpb) bpb+=SEQUENCE.bpb;
						var bMils = Math.round(SEQUENCE.barTotalMillies/bpb);

						var beatNo = 0; var bpbUsed = 0;
						var timePerBeat = SEQUENCE.barTotalMillies/couBeats;
						for (var c = cur_bar ; c < (cur_bar+SEQUENCE.evt.length); c++){
							var ci = (c+SEQUENCE.evt.length)%SEQUENCE.evt.length;
							if (SEQUENCE.evt[ci].isBar()&&ci!=cur_bar)break;
							if (SEQUENCE.evt[ci].isBeat()){
								var target = (beatNo+1) * timePerBeat;

								var bpbThis = 0;
								var bpbUsedBefore = bpbUsed;
								//ts.debug('timePerBeat:'+ timePerBeat + ' target:' + target);
								for (var x = bpbUsed ; x < bpb; x++) {
									var diff =  Math.round(Math.abs(((bpbUsed*bMils)-target))%bMils);
									//ts.debug('distance of ' +(bpbUsed)+'/'+(couBeats)+' beat is '+diff);
									var diff_if_addbeat = Math.round(Math.abs((((bpbUsed+1)*bMils)-target))%bMils);
									//ts.debug('distance of ' +(bpbUsed+1)+'/'+(couBeats)+' beat is '+diff_if_addbeat);
									if (diff_if_addbeat <= diff){
										bpbUsed += 1;
										bpbThis += 1;
										if ((bpbUsed*bMils)>=target)break;
									}
									else break;
								}
								//ts.debug('bpbUsed:'+bpbUsed+' bpbThis:'+bpbThis);
								if (beatNo==0) {title += ' length:'+(bpbThis*bMils);}
								processBeat(ci,beatNo,bpbThis*bMils);
								beatNo += 1;
							}
						}
					}

					if (ts.is.window())SEQUENCE.evt[cur_bar].eBlockChart.title = title;
					cur_bar = SEQUENCE.searchNextBar(cur_bar);
				}
			}
		};
    SEQUENCE.recomputeBar = function(e){
      var tix = SEQUENCE.barTicks;

      e.playArray = new Array();

      // create a tick-grid
      var starttime = 0;
      var available_bar = SEQUENCE.barTotalMillies;
      for (var b = 0; b < SEQUENCE.bpb; b++){
        var available_beat = SEQUENCE.beatMillies;
        if (b == (SEQUENCE.bpb-1)) available_beat = available_bar;
        available_bar -= available_beat;

        for (var t = 0; t < SEQUENCE.tpb; t++){
          var available_tick = SEQUENCE.tickMillies;
          if (t == (SEQUENCE.tpb-1))available_tick = available_beat;
          available_beat -= available_tick;

          e.playArray.push(new Object({
            starttime:starttime,
            ticktime:available_tick,
          }));
          starttime += available_tick;
        }

      }
      ts.debug('total duration: '+starttime)

      // spread out the beats;
      var bcount = e.bar.beats.length;
      var tix_available = tix;
      var tpos = 0;
      var tpb = Math.round(tix/bcount);
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
        ts.debug('bstart='+bstart+' blength='+blength+' musicEvents='+a.length);

        var m_pos = bstart;
        var m_available = blength;
        var tpe_float = blength/a.length;
        for (var m = 0; m < a.length;m++){
          var start = Math.round((m*tpe_float)+bstart);
          ts.debug('musicEvent '+m+' starts on tick '+start);
          if (a[m].isChord())e.playArray[start].chord = (a[m]);
          if (a[m].isMelody())e.playArray[start].melody = (a[m]);
        }

      }

      e.arrayMelody = new Array();
      for (var i = 0 ; i < tix; i++) {
        if (e.playArray[i].melody!=null){
          e.arrayMelody.push(new Object({
            starttime:e.playArray[i].starttime,
            ticktime:e.playArray[i].ticktime,
            event:e.playArray[i].melody,
          }));
        }
      }

      var melpos = 0;
      for (var i = 0 ; i < e.arrayMelody.length; i++) {
        if (i == (e.arrayMelody.length-1)){
          e.arrayMelody[i].ticktime = SEQUENCE.barTotalMillies-e.arrayMelody[i].starttime;
        }
        else {
          e.arrayMelody[i].ticktime = e.arrayMelody[i+1].starttime-e.arrayMelody[i].starttime;
        }
      }

      ts.debug(e);
    };

		SEQUENCE.addEvent = function(str,info,afterIndex){
			var SEQUENCE = this;
			// Global values
			var glob = ts.zs4.string.split.separators(info,':');
			if (glob.length==2){
				//window.alert(info);
        if (glob[0].trim()=='tpb'){
					this.tpb = parseInt(glob[1]);
					if (this.tpb < ts.music.MIN_TICKS_PER_BEAT)this.tpb = ts.music.MIN_TICKS_PER_BEAT;
					else if (this.tpb > ts.music.MAX_TICKS_PER_BEAT) this.tpb = ts.music.MAX_TICKS_PER_BEAT;

          if (ts.is.window())this.bpmTool.eEventTpbInput.value = this.tpb;

				}
        if (glob[0].trim()=='bpb'){
					this.bpb = parseInt(glob[1]);
					if (this.bpb < ts.music.MIN_BEATS_PER_BAR)this.bpb = ts.music.MIN_BEATS_PER_BAR;
					else if (this.bpb > ts.music.MAX_BEATS_PER_BAR) this.bpb = ts.music.MAX_BEATS_PER_BAR;

          if (ts.is.window())this.bpmTool.eEventBpcInput.value = this.bpb;

				}
				if (glob[0].trim()=='bpm'){
					SEQUENCE.bpm = parseInt(glob[1]);
					if (SEQUENCE.bpm < ts.music.MIN_BEATS_PER_MINUTE)SEQUENCE.bpm = MIN_BEATS_PER_MINUTE;
					else if (SEQUENCE.bpm > ts.music.MAX_BEATS_PER_MINUTE) SEQUENCE.bpm = ts.music.MAX_BEATS_PER_MINUTE;

					if (ts.is.window())this.bpmTool.eEventBpmInput.value = this.bpm;
				}

        if (glob[0].trim()=='lf'){
          if (glob[1].trim()=='false'){
            SEQUENCE.layoutlinefeed = false;
            if (ts.is.window())SEQUENCE.toolobject.layout.eLineFeed.checked=false;
          }
          else {
            SEQUENCE.layoutlinefeed = true;
            if (ts.is.window())SEQUENCE.toolobject.layout.eLineFeed.checked=true;
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
				lyric:str.trim(),
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
			};
      if (ts.is.node())o.refresh = function(){};

      var EVENT = o;

	      // MUSICAL info
      ///////////////////////////////////
			while (true){
				if (info.substr(0,1)=='|'){
					//window.alert('|'); // toggleBar
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
      if (str=='\n' && info=='\n')o.linefeed = o.space = true;
      if (str==' ' && info==' ')o.space = true;

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

			this.evt.splice(afterIndex,0,o);

			this.evt_current = o;
			this.evt_curidx = afterIndex;

      if (ts.is.window()){
        o.refresh = function(){
          if (this.chord != null && this.chord.ok){

						this.eChordBaseNote.style.visibility = 'visible';
						this.eChordBaseNote.innerHTML = ts.music.note.symbol(this.chord.v);
						this.eChordType.innerHTML = ts.music.CHORD.TYPE[this.chord.t].s;
						if (this.chord.b != this.chord.v){
							this.eBass.style.display = 'inline';
							this.eBassNote.innerHTML = ts.music.note.symbol(this.chord.b);
						}
						else{
							this.eBass.style.display = 'none';
						}
					}
					else{
						this.eChordBaseNote.style.visibility = 'hidden';
						this.eChordBaseNote.textContent = '|';
						this.eChordType.textContent = '';
						this.eBassNote.textContent = '';
						this.eBass.style.display = 'none';
					}

					if (this.melody < ts.midi.constant.MIDI_NOTE_MIN || this.melody > ts.midi.constant.MIDI_NOTE_MAX ){
						this.eBlockMelody.textContent = '|';
						this.eBlockMelody.style.visibility = 'hidden';
					}else{
						this.eBlockMelody.textContent = ts.music.note.qualified(o.melody);
						this.eBlockMelody.style.visibility = 'visible';
					}

					if (this.bar){
						this.eBlockChart.className = 'tsbar';
					}else if (this.beat){
						this.eBlockChart.className = 'tsbeat';
					}else{
						this.eBlockChart.className = '';
					}
        };

				o.eEvent = document.createElement('span');
				//o.eEvent.style.display = 'inline';
				o.eEvent.ts = o;
				o.eEvent.onclick = function(){this.ts.ts.onEventClick(this.ts);};

				o.eSpan = document.createElement('ts-event');
				o.eSpan.style.display = 'inline-block';
				o.eSpan.style.marginTop = '0.1em';
				o.eSpan.style.marginBottom = '0.1em';
				o.eSpan.ts = o;
				o.eEvent.appendChild(o.eSpan);

				o.eBlockMelody = document.createElement('ts-block-melody');
				o.eBlockMelody.style.height = '1em';
				o.eBlockMelody.style.display = 'block';
				o.eBlockMelody.textContent = '|';
				o.eSpan.appendChild(o.eBlockMelody);

				o.eBlockChart = document.createElement('ts-block-chart');
				o.eBlockChart.style.display = 'block';
				o.eBlockChart.style.height = '1em';
				//o.eBlockChart.textContent = info;
				o.eSpan.appendChild(o.eBlockChart);

					o.eChordBaseNote = document.createElement('ts-chord-base');
					o.eChordBaseNote.textContent = '|';
					o.eChordBaseNote.style.visibility = 'hidden';
					o.eBlockChart.appendChild(o.eChordBaseNote);

					o.eChordType = document.createElement('ts-chord-type');
					o.eChordType.className = '.zs4-size-pct-50';
					o.eBlockChart.appendChild(o.eChordType);

					o.eBass = document.createElement('ts-bass');
					o.eBass.style.display = 'none';
					o.eBlockChart.appendChild(o.eBass);

						o.eSlash = document.createElement('ts-bass-slash');
						o.eBass.appendChild(o.eSlash);
						o.eSlash.textContent = '/';

						o.eBassNote = document.createElement('ts-bass-note');
						o.eBass.appendChild(o.eBassNote);

				o.eBlockLyric = document.createElement('ts-block-lyric');
				o.eBlockLyric.style.display = 'block';
				o.eBlockLyric.textContent = '|';
				o.eBlockLyric.style.visibility = 'hidden';
				o.eBlockLyric.style.height = '1em';
				o.eBlockLyric.ondblclick = function(e){
					SEQUENCE.onEventClick(EVENT);
					if (SEQUENCE.evt[SEQUENCE.evt_curidx]!=EVENT)return;

					var clickpos = parseInt(this.textContent.length * e.offsetX / this.offsetWidth);
					ts.debug(clickpos);
					ts.debug(SEQUENCE);
					ts.debug(EVENT);

					var old = ''; var nu = ''; var orig = this.textContent;
					for (var i = 0 ; i < orig.length; i++){
						if (i < clickpos) old+=orig.charAt(i);
						else nu+=orig.charAt(i);
					}
					ts.debug(old+'-'+nu);
					EVENT.lyric = EVENT.eBlockLyric.textContent = old;
					var nuEvent = SEQUENCE.addEvent(nu,'',(SEQUENCE.evt_curidx+1));
					SEQUENCE.onEventClick(nuEvent);
					ts.debug(nuEvent);
					SEQUENCE.alignHTML();
					//ts.debug(zs4.json.textify(e));
				};
				o.eSpan.appendChild(o.eBlockLyric);

        if (o.linefeed){
  				o.eBlockLyric.style.visibility = 'hidden';
  				o.linefeed = true;
  				o.eLineFeed = document.createElement('br');
  				o.eEvent.appendChild(o.eLineFeed);
  				if (this.toolobject.layout.eLineFeed.checked==true){
  					o.eLineFeed.style.display='initial';
  				}
  				else {
  					o.eLineFeed.style.display='none';
  				}

  			}
  			else if (o.space){
          o.eSpace = document.createElement('span');
          o.eSpace.textContent = ' ';
  				o.eEvent.appendChild(o.eSpace);
  				o.eBlockLyric.textContent = str.trim();
  				o.eBlockLyric.style.visibility = 'visible';
  			}

        if (chord.ok){
          o.eChordBaseNote.textContent = ts.music.note.name(chord.v);
  				o.eChordType.textContent = ts.music.CHORD.TYPE[chord.t].t;
  				if (chord.b != chord.v){
  					o.eBass.style.display = 'inline';
  					o.eBassNote.textContent = ts.music.note.name(chord.b);
  				}
  				else{
  					o.eBass.style.display = 'none';
  				}
  				o.eChordBaseNote.style.visibility = 'visible';
        }
        else {
          o.eChordBaseNote.textContent = '|';
  				o.eChordBaseNote.style.visibility = 'hidden';
        }

        if (o.lyric != ''){
          o.eBlockLyric.textContent=o.lyric;
          o.eBlockLyric.style.visibility = 'visible';
        }

        if (o.eBlockLyric.textContent==''){
  				o.eBlockLyric.textContent = '|';
  				o.eBlockLyric.style.visibility = 'hidden';
  			}

  			this.cnt.appendChild(o.eEvent);
        o.refresh();
      }
			return o;
		};
		SEQUENCE.run = function(){
			this.runChordsAndLyrics();
			this.transpose(0);
			if (this.evt.length > 0)
				this.setCurrentEvent(this.evt[0]);
		};
		SEQUENCE.clearChordsAndLyrics = function(){
			this.evt = new Array();
			this.evt_current = 0;
			this.evt_curidx = this.evt.length-1;
			if (ts.is.window())this.cnt.innerHTML = '';
		};
		SEQUENCE.runChordsAndLyrics = function(data){
			SEQUENCE.data = data;
			if (SEQUENCE.data == null || SEQUENCE.data.length < 1){
        if (ts.is.window()){
          this.toolobject.script.use();
  				return SEQUENCE.cnt;
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
					this.addEvent('\n','\n');
          last_ch_was_space = true;
          last_ch_was_linefeed += 1;
					continue;
				}
        else {
          last_ch_was_linefeed = 0;
        }

        // handle spaces;
				if (ts.zs4.is.space(cur_ch)){
          if (last_ch_was_space)continue;
          if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}
					if (this.evt.length == 0){
						continue;
					}
					if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}
					this.addEvent(' ',' ');
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
					//alert("found chord "+this.data.substr(from,count));
					musinfo = this.data.substr(from,count);

					continue;
				}

        buffer += cur_ch.toString();
			}

      // FLUSH BUFFERS AFTER LOOP
			if (buffer.length > 0||musinfo.length > 0){this.addEvent(buffer,musinfo); buffer="";musinfo="";}

			if (ts.is.window()) this.cnt.appendChild(document.createElement("br"));
			//this.onSelectTool('chord');

			this.setCurrentEvent(this.evt[0]);
			if (ts.is.window())this.refresh();
			//this.renderStats();

			return this.cnt;
		};
		SEQUENCE.getChordsAndLyrics = function(){
			var ret = '[bpb:'+this.bpb+'][bpm:'+this.bpm+'][tpb:'+this.tpb+']';

			if (SEQUENCE.layoutlinefeed){
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

				if (evt.linefeed==true && evt.lyric == '') ret += '\n';
				if (evt.space==true) ret += ' ';
				else ret += evt.lyric.trim();
			}

			return ret;
		};

  if (ts.is.window()){
    SEQUENCE.renderStats = function(){
			this.stsEvents.textContent = ('events:'+this.evt.length+' ');
			this.stsChords.textContent = ('chords:' + this.stats.chords+' ');
			this.stsBars.textContent = ('bars:' + this.stats.bars+' ');
			this.stsBeats.textContent = ('beats:' + this.stats.beats+' ');
			this.stsNotes.textContent = ('notes:' + this.stats.notes+' ');
		};
    SEQUENCE.onLogoClick = function(){
			if (this.evt.length == 0)
				return;

			ts.player.onLogoClick(this);

			this.refresh();
		};
		SEQUENCE.onEventClick = function(evt){
			if (ts.player.is.running()){
				ts.player.onEventClick(this,evt);
			}else{
				this.setCurrentEvent(evt);
				//window.alert(this.current_tool.nam);
				if (this.current_tool!=null){
					if (this.current_tool.nam == 'bars'){
						this.current_tool.toggleBar();
					}
					else if (this.current_tool.nam == 'beats'){
						this.current_tool.toggleBeat();
					}
				}
			}
			this.refresh();
		};

    SEQUENCE.refreshKey = function(){};
		SEQUENCE.refresh = function(){
			//ts.debug('refresh() toonsmith');
			this.updateStats();
			this.renderStats();

			this.recomputeTiming();
			for (var i = 0; i < this.evt.length; i++)this.evt[i].refresh();
			for (var i = 0; i < this.tool.length; i++)this.tool[i].refresh();
			for (var i = 0; i < this.inst.length; i++)this.tool[i].refresh();
			this.refreshLineFeed();
      SEQUENCE.adaptContentPane();
		};
		SEQUENCE.refreshLineFeed = function(){
			var arr = this.evt;
			for (var i = 0 ; i < arr.length; i++){
				if (arr[i].eLineFeed != null){
					if (this.toolobject.layout.eLineFeed.checked){
						arr[i].eLineFeed.style.display='initial';
					}
					else {
						arr[i].eLineFeed.style.display='none';
					}
				}
			}

		};
		SEQUENCE.alignHTML = function(){
			var SEQUENCE = this;
			var PARENT = SEQUENCE.cnt;
			for (var i = 0 ; i < (SEQUENCE.evt.length-1) ; i++){
				PARENT.removeChild(SEQUENCE.evt[i].eEvent);
				PARENT.insertBefore(SEQUENCE.evt[i].eEvent, PARENT.childNodes[i]);
			}

		};

		SEQUENCE.createTool = function(name,icon,tooltype){
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

					if (event.bar){event.bar=null;}
					else if (event.beat){event.beat=null;}
					else {event.bar = {}; event.beat = {};}
					return event;
				},
				toggleBeat:function(){
					var event = this.getCurrentEvent();
					if (event == null)return null;

					if (event.bar == null){
						if (event.beat){
							event.beat=null;
							event.eBlockChart.title ='';
						}
						else event.beat = {};
					}
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
				};
				this.toolobject[name] = nu;
			}

			if (zs4.is.string(icon)){
				nu.toolicon = ts.html.nu.ele('ts-tool-icon-'+icon);
				zs4.admin.util.setIcon(nu.toolicon,icon);
				if (tooltype=='i') nu.ts.instpopped.appendChild(nu.toolicon);
				else nu.ts.toolspopped.appendChild(nu.toolicon);
				//ts.debug('adding icon for '+icon);
				nu.toolicon.onclick = function(){nu.use();SEQUENCE.adaptContentPane(); };
			}

			nu.toolWindow = ts.html.nu.ele('ts-tool-window');
			nu.toolWindow.style.display = 'none';
			nu.toolWindow.ts = this;

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
			nu.toolWindow.appendChild(nu.titleIcon);


			nu.toolTitlebar = ts.html.nu.ele('ts-tool-titlebar');
			nu.toolTitlebar.style.display = 'inline-block';
			nu.toolTitlebar.ts = this;
			if (tooltype=='i') nu.toolWindow.appendChild(nu.toolTitlebar);
			else nu.toolWindow.appendChild(nu.toolTitlebar);



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

		SEQUENCE.createToolInstrument = function(name,icon){
			var nu = this.createTool(name,icon,'i');

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

					if (this.ts.song.evt_current != null){
						if (this.ts.song.evt_current.melody != this.ts.note){
							this.ts.song.evt_current.melody = this.ts.note;
							ts.playNote(this.ts.channel,this.ts.note,64,300);
						}else{
							this.ts.song.evt_current.melody = 0;
						}
						this.ts.song.refresh();
            nu.refresh();
					}
				};

				e.onmouseenter = function(){
					this.ts.tool.iHoverNote.textContent = ts.music.note.qualified(this.ts.note);
				};

				return e;
			};

			nu.instrumentRefresh = function(){};
			nu.refresh = function(){
				for (var i = 0 ; i < nu.instrument.ui.length ; i++ ){
					nu.instrument.ui[i].isChordNote =false;
					nu.instrument.ui[i].isChordRoot =false;
					nu.instrument.ui[i].isMelodyNote =false;
					nu.instrument.ui[i].isMelodyOctave =false;
					nu.instrument.ui[i].e.className = '';
				}
				if (nu.ts.evt_current != null){
					var chord = nu.ts.searchActiveChord();
					if (chord != null){
						nu.iCurrentChordRoot.textContent = ts.music.note.name(chord.v);
						nu.iCurrentChordType.textContent = ts.music.CHORD.TYPE[chord.t].t;
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

			nu.eEventInstrument = ts.html.nu.ele('ts-instrument-' + name);
			//nu.eEventInstrument.style.display = 'inline-block';
			nu.eEventInstrument.className = 'instrument';
			nu.toolTitlebar.appendChild(nu.eEventInstrument);

				nu.iGeneral = ts.html.nu.ele('ts-instrument-general');
				//nu.iGeneral.style.display = 'inline-block';
				nu.eEventInstrument.appendChild(nu.iGeneral);

					nu.iCurrentChord = ts.html.nu.ele('ts-instrument-curchord');
					zs4.admin.util.setIcon(nu.iCurrentChord,'chord');
					nu.iGeneral.appendChild(nu.iCurrentChord);

						nu.iCurrentChordRoot = ts.html.nu.ele('ts-instrument-chord-root');
						nu.iCurrentChord.appendChild(nu.iCurrentChordRoot);

						nu.iCurrentChordType = ts.html.nu.ele('ts-instrument-chord-type');
						nu.iCurrentChord.appendChild(nu.iCurrentChordType);

					nu.iHoverNote = ts.html.nu.ele('ts-instrument-hovernote');
					zs4.admin.util.setIcon(nu.iHoverNote,'note');
					nu.iGeneral.appendChild(nu.iHoverNote);

				nu.iSpecific = ts.html.nu.ele('ts-instrument-specific');
				//nu.iSpecific.style.display = 'block';
				nu.eEventInstrument.appendChild(nu.iSpecific);
				nu.iSpecific.ts = nu;
				nu.iSpecific.onmouseleave = function(){
					this.ts.iHoverNote.textContent = '';
				}

			return nu;
		};
		SEQUENCE.createToolStringInstrument = function(name,icon){
			var fontHeight = '0.5em';

			var nu = this.createToolInstrument(name,icon);
			nu.FRET_COUNT = 7;
			nu.KAPO_MAX = 7;
			nu.KAPO_MIN = 0;
			nu.KAPO_DFT = 0;

			nu.eFretboard = ts.html.nu.ele('table');
			nu.eFretboard.className = 'ts-fretboard';
			nu.iSpecific.appendChild(nu.eFretboard);

			nu.eHeader = ts.html.nu.ele('tr');
			nu.eFretboard.appendChild(nu.eHeader);

			nu.eTdCapo = ts.html.nu.ele('td');
			nu.eHeader.appendChild(nu.eTdCapo);

			nu.eKapo = ts.html.nu.ele('input');
			nu.eKapo.setAttribute('type', 'number');
			//nu.eKapo.style.fontSize = fontHeight;
			nu.eKapo.max = nu.KAPO_MAX;
			nu.eKapo.min = nu.KAPO_MIN;
			nu.eKapo.value = nu.KAPO_DFT;
			nu.eKapo.onchange = function(){nu.setKapo();};
			nu.eTdCapo.appendChild(nu.eKapo);

			nu.eTdEmpty = ts.html.nu.ele('td');
			nu.eHeader.appendChild(nu.eTdEmpty);

			for (var i = 0; i < nu.FRET_COUNT;i++){
				var fret = ts.html.nu.ele('td');
				nu.eHeader.appendChild(fret);
				fret.style.textAlign = "center";
				fret.style.fontSize = '0.4em';
				var text = document.createTextNode(i+1);
				fret.appendChild(text);
			}

			nu.strings = new Array();

			nu.setKapo = function(){
				for (var i = 0; i < nu.strings.length; i++){
					nu.strings[i].retune();
				}
			};

			nu.createString = (function(tuning){

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

				string.eTuning = ts.html.nu.ele('select');
				string.eTdTuning.appendChild(string.eTuning);
				for (var i = tuning+12 ; i >= tuning-12 ; i-- ){
					if (i < ts.midi.constant.MIDI_NOTE_MIN)continue;
					if (i > ts.midi.constant.MIDI_NOTE_MAX)continue;

					var opt = ts.html.nu.ele('option');
					opt.value = i;
					opt.style.fontSize = '0.8em';
					opt.innerHTML = ts.music.note.qualified(i);
					if (i==tuning){
						opt.selected = true;
						string.eTuning.value = i;
					}
					string.eTuning.appendChild(opt);
				}
				string.eTuning.onchange = function(){
					string.retune();
				};

				string.eTdEmpty = ts.html.nu.ele('td');
				string.eTdEmpty.className = 'string';
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
					for (var i = 0 ; i < nu.FRET_COUNT; i++){
						string.fret[i].pad.note = string.pad.note + 1 + i;
					}
					nu.refresh();
				};
				for (var i = 0 ; i < nu.FRET_COUNT; i++){
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
        //ts.debug('STRING INSTRUMENT REFRESH');
				for (var s = 0 ; s < nu.strings.length; s++){
					var str = nu.strings[s];

          //ts.debug('STRING '+s+' REFRESH');

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

					for (var i = 0; i < nu.FRET_COUNT; i++)
						refreshStringPad(str.fret[i].pad,str.fret[i].canvas);

				}
			}).bind(nu);
			return nu;
		};
		SEQUENCE.createToolGuitar = function(){
			var nu = this.createToolStringInstrument('guitar','guitar');
			nu.createString(76);
			nu.createString(71);
			nu.createString(67);
			nu.createString(62);
			nu.createString(57);
			nu.createString(52);
		};
		SEQUENCE.createToolUkulele = function(){
			var nu = this.createToolStringInstrument('ukulele','ukulele');
			nu.createString(81);
			nu.createString(76);
			nu.createString(72);
			nu.createString(79);
		};
		SEQUENCE.createToolBass = function(){
			var nu = this.createToolStringInstrument('bass','bass');
			nu.createString(55);
			nu.createString(50);
			nu.createString(45);
			nu.createString(40);
		};
		SEQUENCE.createToolViolin = function(){
			var nu = this.createToolStringInstrument('violin','violin');
			nu.createString(88);
			nu.createString(81);
			nu.createString(74);
			nu.createString(67);
		};
		SEQUENCE.createToolMandolin = function(){
			var nu = this.createToolStringInstrument('mandolin','mandolin');
			nu.createString(88);
			nu.createString(81);
			nu.createString(74);
			nu.createString(67);
		};
		SEQUENCE.createToolPiano = function(){
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
          //ts.debug('REFRESHING PIANO running='+running);

					for (var i=0;i<nu.instrument.ui.length;i++){
						var pad = nu.instrument.ui[i];


						var canvas = pad.canvas;
						var ctx = canvas.getContext("2d");
						var w = canvas.width;
						var h = canvas.height;
						var lw = w/5;
						//ts.debug(w,h,pad);

						ctx.beginPath();
						ctx.rect(0, 0, w, h);
			      ctx.fillStyle = pad.bgcolor;
			      ctx.fill();

						if (pad.borderLeft){
							//ts.debug('BORDERLEFT!!!');
							ctx.beginPath();
							ctx.lineWidth = lw;
							ctx.moveTo(0,0);
							ctx.lineTo(0,h);
							ctx.strokeStyle = 'rgba(120,120,120,1)';
							ctx.stroke();
						}

						if (pad.borderRight){
							//ts.debug('BORDERLEFT!!!');
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

		SEQUENCE.createToolTranspose = function(){
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
				//ts.debug('transpose.refresh()');
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
    SEQUENCE.createToolBpm = function(){
			var nu = this.createTool('bpm','bpm');

			nu.eEventBpm = ts.html.nu.ele('ts-tool-bpm');
			nu.eEventBpm.style.display = 'inline-block';
			nu.toolTitlebar.appendChild(nu.eEventBpm);

				nu.eEventBpmInput = ts.html.nu.ele('input');
				nu.eEventBpmInput.type = 'number';
				nu.eEventBpmInput.value = this.bpm;
				nu.eEventBpmInput.min = ts.music.MIN_BEATS_PER_MINUTE;
				nu.eEventBpmInput.max = ts.music.MAX_BEATS_PER_MINUTE;
				nu.eEventBpm.appendChild(nu.eEventBpmInput);
				nu.eEventBpmInput.ts = nu;
				nu.eEventBpmInput.onchange = function(){this.ts.ts.bpm = parseInt(this.value); this.ts.ts.refresh();};


      nu.eEventBpc = ts.html.nu.ele('ts-tool-bpb');
			nu.eEventBpc.style.display = 'inline-block';
			nu.toolTitlebar.appendChild(nu.eEventBpc);

        zs4.admin.util.addIconElement(nu.eEventBpc,'beat')
				nu.eEventBpcInput = ts.html.nu.ele('input');
				nu.eEventBpcInput.type = 'number';
				nu.eEventBpcInput.value = this.bpb;
				nu.eEventBpcInput.min = ts.music.MIN_BEATS_PER_BAR;
				nu.eEventBpcInput.max = ts.music.MAX_BEATS_PER_BAR;
				nu.eEventBpc.appendChild(nu.eEventBpcInput);
				nu.eEventBpcInput.ts = nu;
				nu.eEventBpcInput.onchange = function(){
					this.ts.ts.bpb = parseInt(this.value); this.ts.ts.refresh();
				};

      nu.eEventTpb = ts.html.nu.ele('ts-tool-tpb');
			nu.eEventTpb.style.display = 'inline-block';
			nu.toolTitlebar.appendChild(nu.eEventTpb);


        zs4.admin.util.addIconElement(nu.eEventTpb,'tpb');
				nu.eEventTpbInput = ts.html.nu.ele('input');
				nu.eEventTpbInput.type = 'number';
				nu.eEventTpbInput.value = SEQUENCE.tpb;
				nu.eEventTpbInput.min = ts.music.MIN_TICKS_PER_BEAT;
				nu.eEventTpbInput.max = ts.music.MAX_TICKS_PER_BEAT;
				nu.eEventTpb.appendChild(nu.eEventTpbInput);
				nu.eEventTpbInput.ts = nu;
				nu.eEventTpbInput.onchange = function(){SEQUENCE.tpb = parseInt(this.value); this.ts.ts.refresh();};

			return nu;
		};
		SEQUENCE.createToolMidi = function(){
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
		SEQUENCE.createToolAudio = function(){
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
		SEQUENCE.createToolBars = function(){
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
		SEQUENCE.createToolBeats = function(){
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
		SEQUENCE.createToolChord = function(){
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
		SEQUENCE.createToolScript = function(){
			var nu = this.createTool('script','document');

			nu.eTextArea = ts.html.nu.ele('textarea');
			nu.eTextArea.style.width = '100%';
			nu.eTextArea.style.maxWidth = '100%';
			nu.eTextArea.style.minWidth = '100%';
			nu.eTextArea.style.height = 'auto';
			nu.eTextArea.onchange = function(){
				nu.ts.clearChordsAndLyrics();
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
		SEQUENCE.createToolLayout = function(){
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
        if (nu.eLineFeed.checked)SEQUENCE.layoutlinefeed=true;
        else SEQUENCE.layoutlinefeed=false;
				var arr = nu.ts.evt;
				for (var i = 0 ; i < arr.length; i++){
					if (arr[i].eLineFeed != null){
						if (nu.eLineFeed.checked){
							arr[i].eLineFeed.style.display='initial';
						}
						else {
							arr[i].eLineFeed.style.display='none';
						}
					}
				}
			};
			nu.toolTitlebar.appendChild(nu.eLineFeed);

			return nu;
		};
    SEQUENCE.createToolEvent = function(){
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
            ROW.p.icon.onclick = SEQUENCE.setPreviousEvent;

            ROW.c.icon = zs4.admin.util.addIconElement(ROW.c.e,name);

            ROW.n.icon = zs4.admin.util.addIconElement(ROW.n.e,'next');
            ROW.n.icon.onclick = SEQUENCE.setNextEvent;
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
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevBar(SEQUENCE.evt_curidx)]);
      };
      bar.head.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextBar(SEQUENCE.evt_curidx)]);
      };

      var beat = new table('beat');
      beat.head.p.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevBeat(SEQUENCE.evt_curidx)]);
      };
      beat.head.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextBeat(SEQUENCE.evt_curidx)]);
      };

      var chord = new table('chord');
      chord.head.p.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevChord(SEQUENCE.evt_curidx)]);
      };
      chord.head.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextChord(SEQUENCE.evt_curidx)]);
      };

      var note = new table('note');
      note.head.p.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevNote(SEQUENCE.evt_curidx)]);
      };
      note.head.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextNote(SEQUENCE.evt_curidx)]);
      };

      var lyric = new table('lyric');
      lyric.head.p.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevLyric(SEQUENCE.evt_curidx)]);
      };
      lyric.head.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextLyric(SEQUENCE.evt_curidx)]);
      };
      var space = new lyric.row('space');
      space.addIcons('space');
      space.p.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevSpace(SEQUENCE.evt_curidx)]);
      };
      space.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextSpace(SEQUENCE.evt_curidx)]);
      };
      var linefeed = new lyric.row('linefeed');
      linefeed.addIcons('linefeed');
      linefeed.p.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchPrevLinefeed(SEQUENCE.evt_curidx)]);
      };
      linefeed.n.icon.onclick = function(){
        SEQUENCE.setCurrentEvent(SEQUENCE.evt[SEQUENCE.searchNextLinefeed(SEQUENCE.evt_curidx)]);
      };

      //ts.debug(space);


      TOOL.refresh = function(){
				if (this.ts.evt_current != null){
          // UPDATE LABEL
          TOOL.eLabel.textContent =
          'Event: #'
          +SEQUENCE.evt_curidx
          +' of '
          +SEQUENCE.evt.length;

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

		SEQUENCE.createColon = function(){
			var nu = ts.html.nu.ele('ts-colon');
			nu.textContent = ':';
			return nu;
		};
  }
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
			var nu = {v:0,t:0,b:0,ok:true};

			str = str.trim();
			if (str.length < 1){nu.ok=false; return nu;};

			// look up main note name
			for (var i=0;i<ts.music.PLAIN_NOTES.length;i++){
				if (str.substr(0,1).toLowerCase()==ts.music.PLAIN_NOTES[i].n.toLowerCase()){
					nu.v = nu.b = ts.music.PLAIN_NOTES[i].v;
					str = str.substr(1,(str.length-1));
					if (str.length == 0) return nu;
					break;
				}
			}

			//check for sharp or flat
			if (str[0]=='#'){
				nu.v = nu.b = ts.music.transpose.note.name(nu.v,+1);
				str = str.substr(1,(str.length-1));
				if (str.length == 0) return nu;
			}
			else if (str[0]=='b'){
				nu.v = nu.b = ts.music.transpose.note.name(nu.v,-1);
				str = str.substr(1,(str.length-1));
				if (str.length == 0) return nu;
			}

			// chord variant
			for (var i = 0 ; i < ts.music.CHORD.TYPE.length; i++){
				var length = ts.music.CHORD.TYPE[i].t.length;
				if (length > 0 && length <= str.length){
					if (str.substr(0,length).toLowerCase() == ts.music.CHORD.TYPE[i].t.toLowerCase()){
						nu.t = i;
						str = str.substr(length,(str.length-length));
						if (str.length == 0) return nu;
						break;
					}
				}
			}
			if (str.length == 0) return nu;


			// Slash
			if (str[0] != '/'){
				nu.ok = false;
				return nu;
			}
			str = str.substr(1,(str.length-1));

			// bass note
			for (var i=0;i<ts.music.PLAIN_NOTES.length;i++){
				if (str.substr(0,1).toLowerCase()==ts.music.PLAIN_NOTES[i].n.toLowerCase()){
					nu.b = ts.music.PLAIN_NOTES[i].v;
					str = str.substr(1,(str.length-1));
					if (str.length == 0) return nu;
					break;
				}
			}

			//check for sharp or flat
			if (str[0]=='#'){
				nu.b = ts.music.transpose.note.name(nu.b,+1);
				str = str.substr(1,(str.length-1));
				if (str.length == 0) return nu;
			}
			else if (str[0]=='b'){
				nu.b = ts.music.transpose.note.name(nu.b,-1);
				str = str.substr(1,(str.length-1));
				if (str.length == 0) return nu;
			}

			return nu;
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
		{n:'C',s:'C',v:0},
		{n:'C#',s:'C&#x266f;',v:1},
		{n:'D',s:'D',v:2},
		{n:'Eb',s:'E&#x266d;',v:3},
		{n:'E',s:'E',v:4},
		{n:'F',s:'F',v:5},
		{n:'F#',s:'F&#x266f;',v:6},
		{n:'G',s:'G',v:7},
		{n:'Ab',s:'A&#x266d;',v:8},
		{n:'A',s:'A',v:9},
		{n:'Bb',s:'B&#x266d;',v:10},
		{n:'B',s:'B',v:11},
	],
	CHORD:{
		TYPE:[	//				C				D				E		F				G				A				B
			{t:"",			s:'',		a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	false,	false]},
			{t:"-7b5",	s:'&#x2300;',		a:	[true,	false,	false,	true,	false,	false,	true,	false,	false,	false,	true,	false]},
			{t:"-6",		s:'-&#x2076;',		a:	[true,	false,	false,	true,	false,	false,	false,	true,	false,	true,	false,	false]},
			{t:"-7",		s:'-&#x2077;',		a:	[true,	false,	false,	true,	false,	false,	false,	true,	false,	false,	true,	false]},
			{t:"M7",		s:'&#x25B3;',		a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	false,	true]},
			{t:"+7",		s:'+&#x2077;',		a:	[true,	false,	false,	false,	true,	false,	false,	false,	true,	false,	true,	false]},
			{t:"o7",		s:'&#x00B0;&#x2077;',		a:	[true,	false,	false,	true,	false,	false,	true,	false,	false,	true,	false,	false]},
			{t:"-",			s:'-',		a:	[true,	false,	false,	true,	false,	false,	false,	true,	false,	false,	false,	false]},
			{t:"o",			s:'&#x00B0;',		a:	[true,	false,	false,	true,	false,	false,	true,	false,	false,	false,	false,	false]},
			{t:"+",			s:'+',		a:	[true,	false,	false,	false,	true,	false,	false,	false,	true,	false,	false,	false]},

			{t:"6",			s:'&#x2076;',		a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	true,	false,	false]},
			{t:"7",			s:'&#x2077;',		a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	true,	false]},
			{t:"7b9",		s:'&#x2077;&#x1D47;&#x2079;',		a:	[true,	false,	false,	false,	true,	false,	false,	true,	false,	false,	true,	false, false, true]},
		],
	},
	SEMI_TONES_PER_OCTAVE:12,
  MIN_TICKS_PER_BEAT:2,
  MAX_TICKS_PER_BEAT:23,
  MIN_BEATS_PER_BAR:2,
  MAX_BEATS_PER_BAR:23,
	MAX_BEATS_PER_MINUTE:240,
	MIN_BEATS_PER_MINUTE:24,
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
		playMelody:function(e){
      if (e.bar.melodies.length==0)return;
      ts.debug('PLAYING MELODY',e);
      var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      var SEQUENCE = ts.player.ts;

      var available = SEQUENCE.barTotalMillies;
      var a = e.arrayMelody;
      console.log(a);

      for (var i = 0 ; i < a.length ;i++){
        var AR = pi.ATTACKRELEASE;
        var NOTE = a[i];
        if (a[i].ticktime < (AR*2)) AR = a[i].ticktime/2;
        ts.audio.master.melody.noteAtTime(a[i].event.melody,a[i].starttime);
        ts.audio.master.melody.fadeToBy(1,a[i].starttime+AR);
        ts.audio.master.melody.fadeToBy(0,a[i].starttime+a[i].ticktime);

      }

			if (false && pi.chord && e.isBeat()){
				var type = ts.music.CHORD.TYPE[pi.chord.t];

				var note = pi.chord.v + 36;
				var velocity = 30;
				if ((pi.beatsSinceChord & 1)==0){
					if ((pi.beatsSinceChord & 3)==0) velocity = 20;
					ts.playNote(0,note,velocity,Math.round(SEQUENCE.beatMillies*9/10))
				}

				note = pi.chord.v + 60;
				velocity = 30;
				for (var i = 0 ; i < type.a.length ; i++ ){
					if (type.a[i]) ts.playNote(0,note+i,velocity,Math.round(SEQUENCE.beatMillies*9/10));
				}
			}

		},
    playBar:function(bar){
      ts.debug('PLAYING BAR',bar);
      var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      var SEQUENCE = ts.player.ts;

      SEQUENCE.recomputeBar(bar);

      pi.playMelody(bar);
    },
		eventLoop:function(){
			var pi = ts.player.internal;
      var CHANNEL = ts.audio.master;
      // initialize oscillators
      if (pi.osc.mel == null){
        pi.osc.mel = new CHANNEL.oscillator({name:'melody',});
        pi.osc.chord = new Object({
          bass:new CHANNEL.oscillator({name:'bass',}),
          tenor:new CHANNEL.oscillator({name:'tenor',}),
          alto:new CHANNEL.oscillator({name:'alto',}),
          soprano:new CHANNEL.oscillator({name:'bass',}),
        });
      }

			pi.time = (new Date).getTime();
			var SEQUENCE = ts.player.ts;

			if (SEQUENCE != null){
				var ce = SEQUENCE.evt_current;

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
				var nextIdx = SEQUENCE.searchNextEvent();
				if (pi.bar.active.nextEventTime > (pi.time)){
          if (SEQUENCE.evt[nextIdx].isBar()){
            pi.timeout = (pi.bar.active.nextEventTime - (pi.time));
          }
          else {
            var want = (pi.bar.active.nextEventTime - (pi.time));
            pi.timeout = (want + (SEQUENCE.tickMillies-1))%SEQUENCE.tickMillies;
          }
        }
				else {
          pi.timeout = 0;
        }

        var e = SEQUENCE.evt[nextIdx];

				if (SEQUENCE.current_tool) SEQUENCE.current_tool.refresh();
				if (SEQUENCE.current_inst) SEQUENCE.current_inst.refresh();

				if (e.bar && pi.bar.jump){

					if (ts != pi.bar.jumpTs){
						ts.player.attach(pi.bar.jumpTs);
						SEQUENCE = ts.player.ts;
						ce = SEQUENCE.evt_current;
					}
					pi.bar.jumpEventEle.className = '';
					SEQUENCE.setCurrentEvent(SEQUENCE.evt[pi.bar.jumpEvent]);
					pi.bar.jump = false;
				}
        else{
					SEQUENCE.setNextEvent();
				}
        //ce = SEQUENCE.evt_current;

        //update running harmonic and rhythmic state
        if (ce.isChord())	{
  				pi.chord = ce.chord;
  				pi.beatsSinceChord = 0;
  			}
        if (ce.isBar()) {
  				pi.currentBeat = 0;
  				pi.beatsSinceChord = 0;
  				//ts.debug('bar');
  			}
  			else if (ce.isBeat()) {
  				pi.currentBeat += 1;
  				pi.beatsSinceChord += 1;
  				//ts.debug('beat '+(pi.currentBeat+1) );
  			}

        if (ce.isBar()){
          pi.playBar(ce);
        }
				//pi.playMelody(ce);

				SEQUENCE.showEventAsCurrent(ce)
			}
			else if (ts.player.internal.bar.jump && ts.player.internal.bar.jumpTs != null ){
				ts.player.internal.bar.jumpEventEle.className = '';
				ts.player.attach(ts.player.internal.bar.jumpTs);
				ts.player.ts.setCurrentEvent(ts.player.ts.evt[0]);
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
		ts.player.detach();
		zs4.admin.util.setIcon(nuTs.titlebarLogo,'stop');
		nuTs.titlebarElement.appendChild(ts.player.html);
		nuTs.player = ts.player.html;
		ts.player.ts = nuTs;
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
			keep.refresh();
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
				ts.player.onEventClick(clickTs,clickTs.evt[0]);
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

			var SEQUENCE = new ts.create();
			ele.ts = SEQUENCE;
			container.ts = SEQUENCE;

			SEQUENCE.ele = ele;

			ts.initialize();

			// make a title bar;
			SEQUENCE.titlebarElement = ts.html.nu.ele('ts-titlebar');
			SEQUENCE.titlebarElement.style.display = 'block';
			ele.appendChild(SEQUENCE.titlebarElement);

				SEQUENCE.tsTopTools = ts.html.nu.ele('ts-top-tools');
        //nu.tsTopTools.style.fontSize =
				SEQUENCE.titlebarElement.appendChild(SEQUENCE.tsTopTools);

				SEQUENCE.titlebarLogo = ts.html.nu.ele('ts-titlebar-logo');
				SEQUENCE.titlebarLogo.ts = SEQUENCE;
				SEQUENCE.titlebarLogo.onclick = function(){this.ts.onLogoClick();};
				zs4.admin.util.setIcon(SEQUENCE.titlebarLogo,'play');
				SEQUENCE.tsTopTools.appendChild(SEQUENCE.titlebarLogo);

				SEQUENCE.player = null;

				SEQUENCE.toolinst = ts.html.nu.ele('ts-instbutton');
				zs4.admin.util.setIcon(SEQUENCE.toolinst,'instruments');
				SEQUENCE.instArePopped = false;
				SEQUENCE.toolinst.onclick = function(){
					if (SEQUENCE.instArePopped==true){
						SEQUENCE.instpopped.style.display = 'none';
						SEQUENCE.instArePopped = false;
					}else{
						SEQUENCE.instpopped.style.display = 'block';
						SEQUENCE.instArePopped = true;
						SEQUENCE.toolspopped.style.display = 'none';
						SEQUENCE.toolsArePopped = false;
						SEQUENCE.hideAllInstPanes();
					}
          SEQUENCE.adaptContentPane();
				};
				SEQUENCE.tsTopTools.appendChild(SEQUENCE.toolinst);

				SEQUENCE.toolpop = ts.html.nu.ele('ts-toolbutton');
				zs4.admin.util.setIcon(SEQUENCE.toolpop,'tool');
				SEQUENCE.toolsArePopped = false;
				SEQUENCE.toolpop.onclick = function(){
					if (SEQUENCE.toolsArePopped==true){
						SEQUENCE.toolspopped.style.display = 'none';
						SEQUENCE.toolsArePopped = false;
					}else{
						SEQUENCE.toolspopped.style.display = 'block';
						SEQUENCE.toolsArePopped = true;
						SEQUENCE.instpopped.style.display = 'none';
						SEQUENCE.instArePopped = false;
						SEQUENCE.current_tool = null;
						SEQUENCE.hideAllToolPanes();
					}
          SEQUENCE.adaptContentPane();
				};
				SEQUENCE.tsTopTools.appendChild(SEQUENCE.toolpop);

				SEQUENCE.transport = ts.html.nu.ele('ts-transport');
				SEQUENCE.tsTopTools.appendChild(SEQUENCE.transport);

				SEQUENCE.tostart = zs4.admin.util.addIconElement(SEQUENCE.transport,'tostart');
				SEQUENCE.tostart.onclick = function(){SEQUENCE.setCurrentEvent(SEQUENCE.evt[0]);}
				SEQUENCE.prev = zs4.admin.util.addIconElement(SEQUENCE.transport,'prev');
				SEQUENCE.prev.onclick = function(){SEQUENCE.setPreviousEvent();}
				SEQUENCE.next = zs4.admin.util.addIconElement(SEQUENCE.transport,'next');
				SEQUENCE.next.onclick = function(){SEQUENCE.setNextEvent();}
				SEQUENCE.toend = zs4.admin.util.addIconElement(SEQUENCE.transport,'toend');
				SEQUENCE.toend.onclick = function(){SEQUENCE.setCurrentEvent(SEQUENCE.evt[(SEQUENCE.evt.length-1)]);}

				SEQUENCE.toolspopped = ts.html.nu.ele('ts-tool-icons');
				SEQUENCE.toolspopped.style.display = 'none';
				SEQUENCE.titlebarElement.appendChild(SEQUENCE.toolspopped);

				SEQUENCE.instpopped = ts.html.nu.ele('ts-inst-icons');
				SEQUENCE.instpopped.style.display = 'none';
				SEQUENCE.titlebarElement.appendChild(SEQUENCE.instpopped);

			//
			SEQUENCE.toolarea = ts.html.nu.ele('ts-toolarea');
			SEQUENCE.toolarea.style.display = 'block';
			ele.appendChild(SEQUENCE.toolarea);

			SEQUENCE.instarea = ts.html.nu.ele('ts-instarea');
			SEQUENCE.instarea.style.display = 'block';
			ele.appendChild(SEQUENCE.instarea);

			// create content bin
			SEQUENCE.cnt = ts.html.nu.ele('ts-content');
			SEQUENCE.cnt.style.marginLeft = '.5em';
			SEQUENCE.cnt.style.display = 'block';
			ele.appendChild(SEQUENCE.cnt);

      SEQUENCE.adaptContentPane = function(){
        if (SEQUENCE.current_tool == null && SEQUENCE.current_inst == null){
          SEQUENCE.cnt.style.maxHeight = 'initial';
    			SEQUENCE.cnt.style.overflowY = 'initial';
        }
        else {
          SEQUENCE.cnt.style.maxHeight = (window.innerHeight/2)+'px';
    			SEQUENCE.cnt.style.overflowY = 'scroll';
        }
      };

			SEQUENCE.stsElement = ts.html.nu.ele('ts-statusbar');
			SEQUENCE.stsElement.style.display = 'block';
			ele.appendChild(SEQUENCE.stsElement);

				SEQUENCE.stsEvents = ts.html.nu.ele('ts-count-events');
				SEQUENCE.stsElement.appendChild(SEQUENCE.stsEvents);

				SEQUENCE.stsChords = ts.html.nu.ele('ts-count-chords');
				SEQUENCE.stsElement.appendChild(SEQUENCE.stsChords);

				SEQUENCE.stsBars = ts.html.nu.ele('ts-count-bars');
				SEQUENCE.stsBars.className = 'tsbar';
				SEQUENCE.stsElement.appendChild(SEQUENCE.stsBars);

				SEQUENCE.stsBeats = ts.html.nu.ele('ts-count-beat');
				SEQUENCE.stsBeats.className = 'tsbeat';
				SEQUENCE.stsElement.appendChild(SEQUENCE.stsBeats);

				SEQUENCE.stsNotes = ts.html.nu.ele('ts-count-notes');
				SEQUENCE.stsNotes.className = 'tsnote';
				SEQUENCE.stsElement.appendChild(SEQUENCE.stsNotes);

			SEQUENCE.hideAllInstPanes = function(){
				SEQUENCE.current_inst = null;
				for (var i = 0; i < SEQUENCE.inst.length; i++){
					SEQUENCE.inst[i].toolWindow.style.display = 'none';
					SEQUENCE.inst[i].visible = false;
				}
        SEQUENCE.adaptContentPane();
			};
			SEQUENCE.hideAllToolPanes = function(){
				SEQUENCE.current_tool = null;
				for (var i = 0; i < SEQUENCE.tool.length; i++){
					SEQUENCE.tool[i].toolWindow.style.display = 'none';
					SEQUENCE.tool[i].visible = false;
				}
        SEQUENCE.adaptContentPane();
			};

			SEQUENCE.createToolChord();
			SEQUENCE.createToolGuitar();
			SEQUENCE.createToolPiano();
			SEQUENCE.createToolUkulele();
			SEQUENCE.createToolMandolin();

			SEQUENCE.createToolViolin();
			SEQUENCE.createToolBass();

			SEQUENCE.createToolScript();
			SEQUENCE.createToolBars();
			SEQUENCE.createToolBeats();
      SEQUENCE.bpmTool = SEQUENCE.createToolBpm();
			SEQUENCE.createToolTranspose();
			SEQUENCE.createToolAudio();
			SEQUENCE.createToolMidi();
      SEQUENCE.createToolLayout();
      SEQUENCE.createToolEvent();
			return ts.ts = SEQUENCE;
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

				ts.debug('testing ts.midi.access');
				ts.debug(ts.midi.access);
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
        NODE.volume.gain.value = 0.4;
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
        OSC.fadeToBy = function(g,t){
          if(t==null)t=CTX.currentTime;
          else t=CTX.currentTime+(t/1000);
          OSC.adsr.gain.linearRampToValueAtTime(g,(t));};
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

		ts.audio.initialized = true;
		return true;
	},
	play:{
		note:function(channel,note,volume,millies){
			return ts.audio.play.frequency(channel,(440 * Math.pow(2.0,((note-ts.midi.constant.A4_NOTE)/12.0))),volume,millies);
		},
		frequency:function(channel,freq,volume,millies){

				var now = ts.audio.context.currentTime;

				if (volume == null)
				volume = 127;

			var aVol = volume / 127;

			var o = ts.audio.context.createOscillator();
			o.type = 'sine';
			o.frequency.setValueAtTime(freq,now);

			var g = ts.audio.context.createGain();
			g.gain.setValueAtTime((volume / 127),now);

			o.connect(g);
			g.connect(ts.audio.master.destination);


			o.start(0);
			setTimeout(function(){o.stop();},millies);

		},
	},

});
