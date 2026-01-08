import React, { useState, useEffect } from 'react'

const Clock: React.FC = () => {
    const [date, setDate] = useState(new Date())

    useEffect(() => {
        const timer = setInterval(() => {
            setDate(new Date())
        }, 1000)

        return () => clearInterval(timer)
    }, [])

    return (
        <div className="text-right bg-white/40 backdrop-blur-sm p-2">
            <div className="font-bold text-sm leading-none">
                {date.toLocaleDateString('en-GB').replace(/\//g, '-')}
            </div>
            <div className="text-xs text-muted-foreground leading-none mt-1">
                {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
        </div>
    )
}

export default Clock
