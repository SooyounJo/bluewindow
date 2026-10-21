import { useEffect } from 'react';
import { initArchiver } from '@/lib/archiver/engine';
import { MEMORY_MAX } from '@/lib/sensory/prompt';

export default function Home() {
  useEffect(() => initArchiver(), []);

  return (
    <>
      <canvas id="bg"></canvas>

      {/* ================= 랜딩 ================= */}
      <section id="landing" className="screen on">
        <div className="hero">
          <h1 className="title">Spatial Archiver</h1>
          <div className="actions">
            <button className="start" id="startBtn">Start</button>
            <button className="start" id="archiveBtn">Record</button>
          </div>
        </div>
      </section>

      {/* ================= 라이브러리 ================= */}
      <section id="library" className="screen">
        <div className="ring" id="ring"></div>
        <div className="top">
          <button className="back" data-go="landing" aria-label="Back to start">←</button>
          <h2>Library</h2>
        </div>
        <div className="info" id="info" aria-live="polite"></div>
      </section>

      {/* ================= 기록 (Record) ================= */}
      <section id="record" className="screen">
        <div className="top dtop">
          <button className="back" data-go="landing">← Back</button>
          <span className="rtitle">Record</span>
        </div>

        <div className="layout">
          <div className="media">
            <figure>
              <label className="frame photo drop" id="drop">
                <input type="file" id="rFile" accept="image/*" hidden />
                <img id="rImg" alt="" hidden />
                <span className="dropmsg" id="dropMsg"><span><b>Add a photo</b><br />Drop, paste (Ctrl+V), or click to choose</span></span>
              </label>
            </figure>
            <figure>
              <div className="frame panel">
                <canvas id="rGL" width="320" height="640"></canvas>
                <span className="panelmsg" id="panelMsg"><span>Your window<br />appears here</span></span>
              </div>
            </figure>
          </div>

          <aside className="side form">
            <div className="field">
              <label htmlFor="rName">Place</label>
              <input id="rName" type="text" maxLength={40} placeholder="e.g. Hyeopjae Beach, Jeju" autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="rDate">Date</label>
              <input id="rDate" type="date" />
            </div>
            <div className="field">
              <label htmlFor="rMemory">Memory <span className="count" id="rCount">0 / {MEMORY_MAX}</span></label>
              <textarea id="rMemory" maxLength={MEMORY_MAX} rows={2} placeholder="What do you remember about this place?"></textarea>
              <button className="restart primary" id="rGen" disabled>Generate</button>
            </div>
            <div className="field">
              <div className="knobwrap rknob">
                <div className="dial" id="rDial" role="slider" tabIndex={0} aria-label="Clarity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={55}>
                  <canvas id="rDialCanvas" width="440" height="440"></canvas>
                </div>
                <div className="dlabel"><span>Clarity</span><b id="rDialVal">55</b></div>
              </div>
            </div>
            <div className="actions2">
              <button className="restart" id="rSave" disabled>Add to Library</button>
            </div>
            <p className="rnote bad" id="rNote" hidden></p>
          </aside>
        </div>
      </section>

      {/* ================= 상세 ================= */}
      <section id="detail" className="screen">
        <div className="top dtop">
          <button className="back" data-go="library">← Library</button>
          <button className="ledlink" id="panelBtn" aria-expanded="false">LED</button>
        </div>
        <div className="sheet" id="sheet">
          <div className="row">
            <input type="text" id="host" defaultValue="soo-youn1016.local" spellCheck={false} aria-label="Raspberry Pi address" />
            <button className="chip" id="connect">Connect</button>
            <button className="chip" id="rotate">Rotate: CW 90°</button>
          </div>
          <div className="status" id="status">Start the server on the Pi, enter its IP address, then connect.</div>
        </div>

        <div className="layout">
          <div className="media">
            <figure><div className="frame photo"><img id="pImg" alt="" /></div><figcaption>Original space</figcaption></figure>
            <figure><div className="frame panel"><canvas id="pGL" width="320" height="640"></canvas></div><figcaption>Window · LED 32×64</figcaption></figure>
          </div>

          <aside className="side">
            <div className="desc">
              <div className="date" id="pSub"></div>
              <h1 id="pName"></h1>
              <p className="memory" id="pMemory"></p>
              <div className="phase" id="phase" hidden></div>
            </div>

            <div className="controls">
              <div className="knobwrap">
                <div className="dial" id="dial" role="slider" tabIndex={0} aria-label="Clarity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={55}>
                  <canvas id="dialCanvas" width="440" height="440"></canvas>
                </div>
                <div className="dlabel"><span>Clarity</span><b id="dialVal">55</b></div>
              </div>
              <button className="restart" id="replay">↻&nbsp; Restart</button>
            </div>

            <span id="dialHint" hidden></span>
            <button id="soundBtn" hidden>Sound on</button>
            <button id="swapBtn" hidden>Replace photo</button>
            <input type="file" id="fileIn" accept="image/*" hidden />
          </aside>
        </div>
      </section>
    </>
  );
}
