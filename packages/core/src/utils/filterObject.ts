/**
 * 过滤对象返回新的对象
 *
 *
 * @param obj
 * @param filter 当filter返回true时保留,其他的删除
 */
export function filterObject(obj: Record<string | number | symbol, any>, filter: (k: string, v: any) => boolean) {
    if (!obj)
		return {}
    const result: Record<string | number | symbol, any> = {}
	for (const [k, v] of Object.entries(obj)) {
        if (filter(k, v)) {
            result[k] = v
		}
    }
    return result
}
