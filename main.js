import './style.css'
import javascriptLogo from './javascript.svg'
import { setupCounter } from './counter.js'

document.querySelector('#app').innerHTML = `
  <div>
    <div id="churn-cont" />
    <div id="sex-churn-cont" />
    <div id="senior-churn-cont" />
    <div id="tenure-cont" />
    <div id="monthly-charges-cont" />
    <div id="total-charges-cont" />
    <div id="loss-cont"></div>
    <div id="confusion-matrix"></div> 
  </div>
`

setupCounter(document.querySelector('#counter'))
