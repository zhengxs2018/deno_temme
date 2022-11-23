# deno_temme

为了能在 deno 中使用，fork 了 [Temme][temme] 项目。

## 示例

```ts
import { temme } from "https://deno.land/x/deno_temme@v1.0.0/mod.ts";

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

temme(html, selector)
// {
//   fruits: [
//     { color: "red", name: "apple" },
//     { color: "white", name: "pear" },
//     { color: "purple", name: "grape" }
//   ]
// }
```

## License

MIT

[temme]: https://github.com/shinima/temme
