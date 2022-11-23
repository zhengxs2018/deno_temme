import { temme } from '../mod.ts'

const html = `
<ul>
  <li data-fruit-id="1">
    <span data-color="red">apple</span>
  </li>
  <li data-fruit-id="2">
    <span data-color="white">pear</span>
  </li>
  <li data-fruit-id="3">
    <span data-color="purple">grape</span>
  </li>
</ul>
`

const selector = `li@fruits {
  span[data-color=$color]{$name};
}`

console.log(temme(html, selector))
