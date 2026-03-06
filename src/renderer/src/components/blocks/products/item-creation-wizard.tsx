import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as Yup from 'yup'
import {
    Package,
    ChevronRight,
    ChevronLeft,
    Check,
    Upload,
    X,
    Layers,
    Info
} from 'lucide-react'
import { toast } from 'sonner'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Textarea } from '@renderer/components/ui/textarea'
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from '@renderer/components/ui/form'
import { Separator } from '@renderer/components/ui/separator'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { cn } from '@renderer/lib/utils'
import { CustomInput } from '@renderer/components/ui/custom-input'

// API and Hooks
import { useMutation } from '@tanstack/react-query'
import { API_Endpoints } from '@renderer/config/endpoints'
import { ControlledTextField } from '@renderer/components/form/controlled-text-field'
import { useActiveScope } from '@renderer/hooks/useActiveScope'
import { useScopedHotkeys } from '@renderer/hooks/useScopedHotkeys'

interface ItemCreationWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: (item: any) => void
    editItemCode?: string
    selectedPriceList?: string
}

const wizardSchema = Yup.object({
    item_group: Yup.string().required('Item Group is required'),
    brand_name: Yup.string().optional().default(''),
    product_name: Yup.string().required('Product Name is required'),
    flavour_name: Yup.string().optional().default(''),
    description: Yup.string().optional().default(''),
    unit: Yup.string().optional().default(''),
    stock_uom: Yup.string().required('Base Unit is required'),
    level_1_uom: Yup.string().optional().default(''),
    level_1_qty: Yup.number().optional().default(0),
    level_2_uom: Yup.string().optional().default(''),
    level_2_qty: Yup.number().optional().default(0),
    level_3_uom: Yup.string().optional().default(''),
    level_3_qty: Yup.number().optional().default(0),
    level_4_uom: Yup.string().optional().default(''),
    level_4_qty: Yup.number().optional().default(0),
    image: Yup.mixed().optional()
})

interface WizardFormData {
    item_group: string
    brand_name: string
    product_name: string
    flavour_name: string
    description: string
    unit: string
    stock_uom: string
    level_1_uom: string
    level_1_qty: number
    level_2_uom: string
    level_2_qty: number
    level_3_uom: string
    level_3_qty: number
    level_4_uom: string
    level_4_qty: number
    image?: any
}

const STEPS = [
    { id: 'classification', title: 'Classification', icon: <Package className="h-4 w-4" /> },
    { id: 'details', title: 'Details & Units', icon: <Layers className="h-4 w-4" /> },
    { id: 'image_upload', title: 'Image Upload', icon: <Upload className="h-4 w-4" /> }
]

const ItemCreationWizard: React.FC<ItemCreationWizardProps> = ({ open, onOpenChange, onSuccess, editItemCode, selectedPriceList }) => {
    const isEditMode = !!editItemCode
    const [currentStep, setCurrentStep] = useState(0)
    const [previewImage, setPreviewImage] = useState<string | null>(null)
    const [isFetchingItemDetails, setIsFetchingItemDetails] = useState(false)

    // Activate hotkey scope when this wizard is open
    useActiveScope(open ? 'item-creation-wizard' : 'global')

    // Pagination and Search States
    const perPage = 10
    const [groupTerm, setGroupTerm] = useState('')
    const [groupPage, setGroupPage] = useState(1)
    const [groupList, setGroupList] = useState<any[]>([])
    const [hasMoreGroups, setHasMoreGroups] = useState(true)
    const [isFetchingGroups, setIsFetchingGroups] = useState(false)
    const latestGroupReq = useRef(0)

    const [brandTerm, setBrandTerm] = useState('')
    const [brandPage, setBrandPage] = useState(1)
    const [brandList, setBrandList] = useState<string[]>([])
    const [hasMoreBrands, setHasMoreBrands] = useState(true)
    const [isFetchingBrands, setIsFetchingBrands] = useState(false)
    const latestBrandReq = useRef(0)

    const [showGroupSuggestions, setShowGroupSuggestions] = useState(false)
    const [showBrandSuggestions, setShowBrandSuggestions] = useState(false)

    const [uomTerm, setUomTerm] = useState('')
    const [uomPage, setUomPage] = useState(1)
    const [uomList, setUomList] = useState<any[]>([])
    const [hasMoreUoms, setHasMoreUoms] = useState(true)
    const [isFetchingUoms, setIsFetchingUoms] = useState(false)
    const latestUomReq = useRef(0)
    const [activeUomLevel, setActiveUomLevel] = useState<number | null>(null)

    const [groupHighlightedIndex, setGroupHighlightedIndex] = useState(-1)
    const [brandHighlightedIndex, setBrandHighlightedIndex] = useState(-1)
    const [uomHighlightedIndex, setUomHighlightedIndex] = useState(-1)

    useEffect(() => {
        setUomHighlightedIndex(-1)
    }, [activeUomLevel])

    const groupScrollRef = useRef<HTMLDivElement>(null)
    const brandScrollRef = useRef<HTMLDivElement>(null)
    const uomScrollRef = useRef<HTMLDivElement>(null)

    const form = useForm<WizardFormData>({
        resolver: yupResolver(wizardSchema) as any,
        defaultValues: {
            item_group: '',
            brand_name: '',
            product_name: '',
            flavour_name: '',
            description: '',
            unit: '',
            stock_uom: 'Nos',
            level_1_uom: '',
            level_1_qty: 0,
            level_2_uom: '',
            level_2_qty: 0,
            level_3_uom: '',
            level_3_qty: 0,
            level_4_uom: '',
            level_4_qty: 0
        }
    })

    const l1 = form.watch('level_1_uom')
    const l2 = form.watch('level_2_uom')
    const l3 = form.watch('level_3_uom')
    const l4 = form.watch('level_4_uom')
    const stockUom = form.watch('stock_uom') || 'Nos'

    const calculatedDefaultUnit = useMemo(() => {
        if (l4) return l4
        if (l3) return l3
        if (l2) return l2
        if (l1) return l1
        return stockUom
    }, [l1, l2, l3, l4, stockUom])

    useEffect(() => {
        form.setValue('unit', calculatedDefaultUnit)
    }, [calculatedDefaultUnit, form])

    // Fetching Lists using Electron Proxy with Server-Side Search & Pagination
    const fetchItemGroups = async (term: string, pageToLoad = 1, append = false) => {
        const requestId = ++latestGroupReq.current
        if (append) setIsFetchingGroups(true)
        try {
            const res = await window.electronAPI?.proxy?.request({
                url: `/api/${API_Endpoints.ITEM_GROUP_LIST}`,
                method: 'GET',
                params: {
                    search_key: term || '',
                    limit_start: (pageToLoad - 1) * perPage,
                    limit_page_length: perPage
                }
            })
            if (requestId !== latestGroupReq.current) return

            const fetched = res?.data?.data?.item_groups || []
            setGroupList(prev => append ? [...prev, ...fetched] : fetched)
            setHasMoreGroups(fetched.length === perPage)
            setGroupPage(pageToLoad)
        } catch (e) {
            console.error('Failed to fetch item groups', e)
        } finally {
            setIsFetchingGroups(false)
        }
    }

    const fetchBrands = async (term: string, pageToLoad = 1, append = false) => {
        const requestId = ++latestBrandReq.current
        if (append) setIsFetchingBrands(true)
        try {
            const res = await window.electronAPI?.proxy?.request({
                url: `/api/${API_Endpoints.BRAND_LIST}`,
                method: 'GET',
                params: {
                    search_key: term || '',
                    limit_start: (pageToLoad - 1) * perPage,
                    limit_page_length: perPage
                }
            })
            if (requestId !== latestBrandReq.current) return

            const data = res?.data?.data
            let fetched: string[] = []
            if (Array.isArray(data)) fetched = data
            else fetched = data?.brands || data?.brand_list || []

            setBrandList(prev => append ? [...prev, ...fetched] : fetched)
            setHasMoreBrands(fetched.length === perPage)
            setBrandPage(pageToLoad)
        } catch (e) {
            console.error('Failed to fetch brands', e)
        } finally {
            setIsFetchingBrands(false)
        }
    }

    const fetchUoms = async (term: string, pageToLoad = 1, append = false) => {
        const requestId = ++latestUomReq.current
        if (append) setIsFetchingUoms(true)
        try {
            const res = await window.electronAPI?.proxy?.request({
                url: `/api/${API_Endpoints.UOM_LIST}`,
                method: 'GET',
                params: {
                    search_key: term || '',
                    limit_start: (pageToLoad - 1) * perPage,
                    limit_page_length: perPage
                }
            })
            if (requestId !== latestUomReq.current) return

            const body = res?.data?.data || res?.data?.message
            let fetched: any[] = []

            if (Array.isArray(body)) {
                fetched = body
            } else if (body) {
                fetched = body.uoms || body.uom_list || body.data || []
            }

            setUomList(prev => append ? [...prev, ...fetched] : fetched)
            setHasMoreUoms(fetched.length === perPage)
            setUomPage(pageToLoad)
        } catch (e: any) {
            console.error('Failed to fetch UOMs', e)
            toast.error(e.message || 'Failed to fetch UOMs')
        } finally {
            setIsFetchingUoms(false)
        }
    }

    // Fetch Item Details for Edit Mode
    const fetchItemDetails = async (code: string) => {
        setIsFetchingItemDetails(true)
        try {
            const res = await window.electronAPI?.proxy?.request({
                url: `/api/${API_Endpoints.ITEM_DETAILS}`,
                method: 'GET',
                params: {
                    item_code: code,
                    price_list: selectedPriceList || 'Standard Selling'
                }
            })

            const data = res?.data?.data
            if (data) {
                form.reset({
                    item_group: data.item_group || '',
                    brand_name: data.format_details.brand_name || '',
                    product_name: data.format_details.product_name || '',
                    flavour_name: data.format_details.flavour_name || '',
                    description: data.format_details.description || '',
                    unit: data.format_details.unit || '',
                    stock_uom: data.stock_uom || 'Nos',
                    level_1_uom: data.packaging_levels?.level_1_uom || '',
                    level_1_qty: data.packaging_levels?.level_1_qty || 0,
                    level_2_uom: data.packaging_levels?.level_2_uom || '',
                    level_2_qty: data.packaging_levels?.level_2_qty || 0,
                    level_3_uom: data.packaging_levels?.level_3_uom || '',
                    level_3_qty: data.packaging_levels?.level_3_qty || 0,
                    level_4_uom: data.packaging_levels?.level_4_uom || '',
                    level_4_qty: data.packaging_levels?.level_4_qty || 0,
                })

                if (data.image_url) {
                    setPreviewImage(data.image_url)
                }
            }
        } catch (e) {
            console.error('Failed to fetch item details', e)
            toast.error('Failed to load item details')
        } finally {
            setIsFetchingItemDetails(false)
        }
    }

    useEffect(() => {
        if (open && editItemCode) {
            fetchItemDetails(editItemCode)
        } else if (open && !editItemCode) {
            resetWizard()
        }
    }, [open, editItemCode])

    // Debounced effects for searching
    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            fetchItemGroups(groupTerm, 1, false)
        }, 300)
        return () => clearTimeout(timer)
    }, [groupTerm, open])

    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            fetchBrands(brandTerm, 1, false)
        }, 300)
        return () => clearTimeout(timer)
    }, [brandTerm, open])

    useEffect(() => {
        if (!open) return
        const timer = setTimeout(() => {
            fetchUoms(uomTerm, 1, false)
        }, 300)
        return () => clearTimeout(timer)
    }, [uomTerm, open])

    // Mutation for creation/update using Electron Proxy
    const { mutate: submitItem, isPending } = useMutation({
        mutationFn: async (payload: any) => {
            const endpoint = isEditMode ? API_Endpoints.ITEM_EDIT : API_Endpoints.ITEM_CREATE

            const res = await window.electronAPI?.proxy?.request({
                method: 'POST',
                url: `/api/${endpoint}`,
                data: payload
            })

            if (!res?.success || res?.status !== 200) {
                throw new Error(res?.error || res?.data?.message || `Failed to ${isEditMode ? 'update' : 'create'} item`)
            }

            return res.data
        },
        onSuccess: (data: any) => {
            toast.success(`Item ${isEditMode ? 'updated' : 'created'} successfully!`)
            onSuccess?.(data?.message || data)
            onOpenChange(false)
            resetWizard()
        },
        onError: (err: any) => {
            console.error(`Item ${isEditMode ? 'update' : 'creation'} error:`, err)
            toast.error(err?.message || `Failed to ${isEditMode ? 'update' : 'create'} item`)
        }
    })

    const resetWizard = () => {
        setCurrentStep(0)
        form.reset()
        setPreviewImage(null)
        setGroupHighlightedIndex(-1)
        setBrandHighlightedIndex(-1)
        setUomHighlightedIndex(-1)
    }

    useScopedHotkeys('ctrl+enter, command+enter', (e) => {
        e.preventDefault()
        if (currentStep < STEPS.length - 1) {
            handleNext()
        } else {
            form.handleSubmit(onSubmit)()
        }
    }, {}, [currentStep], 'item-creation-wizard')

    const handleNext = async () => {
        const fields = currentStep === 0
            ? ['item_group', 'product_name']
            : currentStep === 1
                ? ['stock_uom']
                : []

        const isValid = await form.trigger(fields as any)
        if (isValid) {
            setCurrentStep((prev) => Math.min(prev + 1, STEPS.length - 1))
        }
    }

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0))
    }

    const onSubmit = async (data: WizardFormData) => {
        if (currentStep < STEPS.length - 1) {
            handleNext()
            return
        }

        const groupExists = Array.isArray(groupList) && groupList.some(g => g.name === data.item_group)
        if (!groupExists && data.item_group !== 'Products') {
            form.setError('item_group', { type: 'manual', message: 'Please select an existing group' })
            toast.error('Please select an existing Item Group')
            setCurrentStep(0)
            return
        }

        const payload: Record<string, any> = {}
        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '' && key !== 'image') {
                payload[key] = value
            }
        })

        payload.stock_uom = payload.stock_uom || 'Nos'

        if (data.image instanceof File) {
            try {
                const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => resolve(reader.result as string)
                    reader.onerror = reject
                    reader.readAsDataURL(data.image as File)
                })
                payload.image = base64
            } catch (error) {
                console.warn('Failed to convert image to base64', error)
            }
        }

        if (isEditMode && editItemCode) {
            payload.item_code = editItemCode
        }

        submitItem(payload)
    }

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            form.setValue('image', file)
            const reader = new FileReader()
            reader.onloadend = () => {
                setPreviewImage(reader.result as string)
            }
            reader.readAsDataURL(file)
        }
    }

    const handleGroupKeyDown = (e: React.KeyboardEvent) => {
        if (!showGroupSuggestions || groupList.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setGroupHighlightedIndex(prev => (prev < groupList.length - 1 ? prev + 1 : prev))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setGroupHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
        } else if (e.key === 'Enter' && groupHighlightedIndex >= 0) {
            e.preventDefault()
            const selected = groupList[groupHighlightedIndex]
            form.setValue('item_group', selected.name)
            setGroupTerm('')
            setShowGroupSuggestions(false)
            setGroupHighlightedIndex(-1)
        }
    }

    const handleBrandKeyDown = (e: React.KeyboardEvent) => {
        if (!showBrandSuggestions || brandList.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setBrandHighlightedIndex(prev => (prev < brandList.length - 1 ? prev + 1 : prev))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setBrandHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
        } else if (e.key === 'Enter' && brandHighlightedIndex >= 0) {
            e.preventDefault()
            const selected = brandList[brandHighlightedIndex]
            form.setValue('brand_name', selected)
            setBrandTerm('')
            setShowBrandSuggestions(false)
            setBrandHighlightedIndex(-1)
        }
    }

    const handleUomKeyDown = (e: React.KeyboardEvent, level: number) => {
        if (activeUomLevel !== level || uomList.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setUomHighlightedIndex(prev => (prev < uomList.length - 1 ? prev + 1 : prev))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setUomHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev))
        } else if (e.key === 'Enter' && uomHighlightedIndex >= 0) {
            e.preventDefault()
            const selected = uomList[uomHighlightedIndex]
            const name = typeof selected === 'string' ? selected : selected.name
            form.setValue(`level_${level}_uom` as any, name)
            setUomTerm('')
            setActiveUomLevel(null)
            setUomHighlightedIndex(-1)
        }
    }

    useEffect(() => {
        if (groupHighlightedIndex >= 0 && groupScrollRef.current) {
            const el = groupScrollRef.current.children[groupHighlightedIndex] as HTMLElement
            if (el) el.scrollIntoView({ block: 'nearest' })
        }
    }, [groupHighlightedIndex])

    useEffect(() => {
        if (brandHighlightedIndex >= 0 && brandScrollRef.current) {
            const el = brandScrollRef.current.children[brandHighlightedIndex] as HTMLElement
            if (el) el.scrollIntoView({ block: 'nearest' })
        }
    }, [brandHighlightedIndex])

    useEffect(() => {
        if (uomHighlightedIndex >= 0 && uomScrollRef.current) {
            const el = uomScrollRef.current.children[uomHighlightedIndex] as HTMLElement
            if (el) el.scrollIntoView({ block: 'nearest' })
        }
    }, [uomHighlightedIndex])

    const renderStepContent = () => {
        switch (currentStep) {
            case 0:
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="item_group"
                                render={({ field }) => (
                                    <FormItem className="relative">
                                        <FormLabel>Item Group <span className="text-destructive ml-1">*</span></FormLabel>
                                        <div className="relative group/group-sel">
                                            <FormControl>
                                                <CustomInput
                                                    {...field}
                                                    placeholder="Select Group"
                                                    size="sm"
                                                    autoComplete="off"
                                                    className={cn(form.formState.errors.item_group && "border-destructive")}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value)
                                                        setGroupTerm(e.target.value)
                                                        setShowGroupSuggestions(true)
                                                    }}
                                                    onFocus={() => setShowGroupSuggestions(true)}
                                                    onBlur={() => {
                                                        setTimeout(() => setShowGroupSuggestions(false), 200)
                                                    }}
                                                    onKeyDown={handleGroupKeyDown}
                                                />
                                            </FormControl>

                                            {showGroupSuggestions && groupList.length > 0 && (
                                                <div
                                                    className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto flex flex-col"
                                                    onScroll={(e) => {
                                                        const el = e.currentTarget
                                                        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
                                                        if (nearBottom && hasMoreGroups && !isFetchingGroups) {
                                                            fetchItemGroups(groupTerm, groupPage + 1, true)
                                                        }
                                                    }}
                                                >
                                                    <div className="p-1" ref={groupScrollRef}>
                                                        {groupList.map((group, index) => (
                                                            <div
                                                                key={group.name}
                                                                className={cn(
                                                                    "px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer transition-colors rounded-sm flex items-center justify-between group",
                                                                    groupHighlightedIndex === index && "bg-slate-100"
                                                                )}
                                                                onClick={() => {
                                                                    field.onChange(group.name)
                                                                    setGroupTerm('')
                                                                    setShowGroupSuggestions(false)
                                                                    setGroupHighlightedIndex(-1)
                                                                }}
                                                                onMouseEnter={() => setGroupHighlightedIndex(index)}
                                                            >
                                                                <span>{group.name}</span>
                                                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        ))}
                                                        {isFetchingGroups && (
                                                            <div className="p-2 text-center text-xs text-muted-foreground animate-pulse">
                                                                Loading more...
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="brand_name"
                                render={({ field }) => (
                                    <FormItem className="relative">
                                        <FormLabel>Brand</FormLabel>
                                        <div className="relative group/brand-sel">
                                            <FormControl>
                                                <CustomInput
                                                    {...field}
                                                    placeholder="Select Brand"
                                                    size="sm"
                                                    autoComplete="off"
                                                    className={cn(form.formState.errors.brand_name && "border-destructive")}
                                                    onChange={(e) => {
                                                        field.onChange(e.target.value)
                                                        setBrandTerm(e.target.value)
                                                        setShowBrandSuggestions(true)
                                                    }}
                                                    onFocus={() => setShowBrandSuggestions(true)}
                                                    onBlur={() => {
                                                        setTimeout(() => setShowBrandSuggestions(false), 200)
                                                    }}
                                                    onKeyDown={handleBrandKeyDown}
                                                />
                                            </FormControl>

                                            {showBrandSuggestions && brandList.length > 0 && (
                                                <div
                                                    className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto flex flex-col"
                                                    onScroll={(e) => {
                                                        const el = e.currentTarget
                                                        const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 100
                                                        if (nearBottom && hasMoreBrands && !isFetchingBrands) {
                                                            fetchBrands(brandTerm, brandPage + 1, true)
                                                        }
                                                    }}
                                                >
                                                    <div className="p-1" ref={brandScrollRef}>
                                                        {brandList.map((brand: string, index) => (
                                                            <div
                                                                key={brand}
                                                                className={cn(
                                                                    "px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer transition-colors rounded-sm",
                                                                    brandHighlightedIndex === index && "bg-slate-100"
                                                                )}
                                                                onClick={() => {
                                                                    field.onChange(brand)
                                                                    setBrandTerm('')
                                                                    setShowBrandSuggestions(false)
                                                                    setBrandHighlightedIndex(-1)
                                                                }}
                                                                onMouseEnter={() => setBrandHighlightedIndex(index)}
                                                            >
                                                                {brand}
                                                            </div>
                                                        ))}
                                                        {isFetchingBrands && (
                                                            <div className="p-2 text-center text-xs text-muted-foreground animate-pulse">
                                                                Loading more...
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </FormItem>
                                )}
                            />
                        </div>

                        <ControlledTextField
                            name="product_name"
                            label="Product Name"
                            control={form.control}
                            placeholder="e.g. MANGO JUICE"
                            required
                            hideErrorMessage
                        />

                        <ControlledTextField
                            name="flavour_name"
                            label="Flavour"
                            control={form.control}
                            placeholder="e.g. FRESH"
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="Enter product description" {...field} className="min-h-[80px]" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <ControlledTextField
                            name="unit"
                            label="Unit (Size)"
                            control={form.control}
                            placeholder="e.g. 2KG, 500ML"
                        />
                    </div>
                )
            case 1:
                return (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="grid grid-cols-2 gap-4">
                            <FormItem>
                                <FormLabel>Base Unit (Fixed)</FormLabel>
                                <div className="h-10 px-3 py-2 border rounded-lg bg-slate-50 text-slate-500 text-sm flex items-center">
                                    Nos
                                </div>
                                <FormDescription>Standard base unit for all items</FormDescription>
                            </FormItem>
                            <FormItem>
                                <FormLabel>Default Unit (Highest Level)</FormLabel>
                                <div className="h-10 px-3 py-2 border rounded-lg bg-blue-50/50 text-blue-700 font-medium text-sm flex items-center">
                                    {calculatedDefaultUnit}
                                </div>
                                <FormDescription>Highest selected UOM level</FormDescription>
                            </FormItem>
                        </div>

                        <Separator />
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium flex items-center gap-2">
                                <Layers className="h-4 w-4" /> Multi-Level Units (Optional)
                            </h4>
                            <div className="grid grid-cols-1 gap-3">
                                {[1, 2, 3, 4].map((level) => (
                                    <div key={level} className="grid grid-cols-2 gap-3 p-2 border rounded-md bg-slate-50/50">
                                        <FormField
                                            control={form.control}
                                            name={`level_${level}_uom` as any}
                                            render={({ field }) => (
                                                <FormItem className="relative">
                                                    <FormLabel className="text-xs">Level {level} UOM</FormLabel>
                                                    <div className="relative">
                                                        <FormControl>
                                                            <CustomInput
                                                                {...field}
                                                                placeholder="Select UOM"
                                                                size="sm"
                                                                autoComplete="off"
                                                                className={cn("h-8 text-xs", form.formState.errors[`level_${level}_uom` as any] && "border-destructive")}
                                                                onChange={(e) => {
                                                                    field.onChange(e.target.value)
                                                                    setUomTerm(e.target.value)
                                                                    setActiveUomLevel(level)
                                                                }}
                                                                onFocus={() => {
                                                                    setActiveUomLevel(level)
                                                                    if (uomList.length === 0) fetchUoms('', 1, false)
                                                                }}
                                                                onBlur={() => {
                                                                    setTimeout(() => setActiveUomLevel(null), 200)
                                                                }}
                                                                onKeyDown={(e) => handleUomKeyDown(e, level)}
                                                            />
                                                        </FormControl>

                                                        {activeUomLevel === level && Array.isArray(uomList) && uomList.length > 0 && (
                                                            <div
                                                                className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-40 overflow-y-auto flex flex-col"
                                                                onScroll={(e) => {
                                                                    const el = e.currentTarget
                                                                    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
                                                                    if (nearBottom && hasMoreUoms && !isFetchingUoms) {
                                                                        fetchUoms(uomTerm, uomPage + 1, true)
                                                                    }
                                                                }}
                                                            >
                                                                <div className="p-1" ref={uomScrollRef}>
                                                                    {uomList.map((uom: any, index) => (
                                                                        <div
                                                                            key={uom.name || uom}
                                                                            className={cn(
                                                                                "px-2 py-1.5 text-xs hover:bg-slate-100 cursor-pointer transition-colors rounded-sm",
                                                                                uomHighlightedIndex === index && "bg-slate-100"
                                                                            )}
                                                                            onClick={() => {
                                                                                field.onChange(uom.name || uom)
                                                                                setUomTerm('')
                                                                                setActiveUomLevel(null)
                                                                                setUomHighlightedIndex(-1)
                                                                            }}
                                                                            onMouseEnter={() => setUomHighlightedIndex(index)}
                                                                        >
                                                                            {uom.name || uom}
                                                                        </div>
                                                                    ))}
                                                                    {isFetchingUoms && (
                                                                        <div className="p-1.5 text-center text-[10px] text-muted-foreground animate-pulse">
                                                                            Loading more...
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </FormItem>
                                            )}
                                        />
                                        <ControlledTextField
                                            name={`level_${level}_qty` as any}
                                            label={`Level ${level} Qty`}
                                            control={form.control}
                                            type="number"
                                            className="h-8"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div >
                )
            case 2:
                return (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors relative group">
                            {previewImage ? (
                                <div className="relative w-40 h-40">
                                    <img src={previewImage} alt="Preview" className="w-full h-full object-cover rounded-lg shadow-md" />
                                    <button
                                        onClick={() => { setPreviewImage(null); form.setValue('image', undefined) }}
                                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <Upload className="h-10 w-10 text-muted-foreground mb-2 group-hover:scale-110 transition-transform" />
                                    <p className="text-sm font-medium">Upload Product Image</p>
                                    <p className="text-xs text-muted-foreground mt-1 text-center">Drag and drop or click to select</p>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                    />
                                </>
                            )}
                        </div>

                        <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                            <h4 className="text-sm font-semibold text-blue-900 flex items-center gap-2 mb-3">
                                <Info className="h-4 w-4" /> Final Item Details
                            </h4>
                            <div className="space-y-3">
                                <div className="p-3 bg-white border border-blue-200 rounded-lg shadow-sm">
                                    <p className="text-[10px] uppercase tracking-wider text-blue-500 font-bold mb-1">Generated Item Name</p>
                                    <p className="text-base font-bold text-slate-900 leading-tight">
                                        {[
                                            form.getValues('brand_name'),
                                            form.getValues('product_name'),
                                            form.getValues('flavour_name'),
                                            form.getValues('description'),
                                            form.getValues('unit')
                                        ].filter(val => val && val.toLowerCase() !== 'undefined').join(' ')}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Group</p>
                                        <p className="font-semibold">{form.getValues('item_group') || 'N/A'}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Base Unit</p>
                                        <p className="font-semibold">Nos</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-500">Default Unit</p>
                                        <p className="font-semibold text-blue-600">{calculatedDefaultUnit}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            default:
                return null
        }
    }

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) resetWizard()
            onOpenChange(isOpen)
        }}>
            <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                            <Package className="h-5 w-5" />
                        </div>
                        {isEditMode ? `Edit Item: ${editItemCode}` : 'Create New Item'}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-4 px-1">
                        {STEPS.map((step, index) => (
                            <React.Fragment key={step.id}>
                                <div
                                    className={cn(
                                        "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                                        currentStep === index
                                            ? "bg-primary text-primary-foreground shadow-md"
                                            : index < currentStep
                                                ? "bg-green-100 text-green-700"
                                                : "bg-slate-100 text-slate-500"
                                    )}
                                >
                                    {index < currentStep ? <Check className="h-3 w-3" /> : step.icon}
                                    {step.title}
                                </div>
                                {index < STEPS.length - 1 && (
                                    <div className="h-px flex-1 bg-slate-200" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={(e) => e.preventDefault()} className="flex flex-col flex-1 overflow-hidden">
                        <ScrollArea className="flex-1 px-6 py-4">
                            {isFetchingItemDetails ? (
                                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                                    <p className="text-sm text-muted-foreground">Loading item details...</p>
                                </div>
                            ) : (
                                renderStepContent()
                            )}
                        </ScrollArea>

                        <DialogFooter className="p-6 pt-2 border-t bg-slate-50/50">
                            <div className="flex justify-between w-full">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={handleBack}
                                    disabled={currentStep === 0}
                                >
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                                </Button>

                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            resetWizard()
                                            onOpenChange(false)
                                        }}
                                    >
                                        Cancel
                                    </Button>

                                    {currentStep < STEPS.length - 1 ? (
                                        <Button type="button" onClick={handleNext}>
                                            Next <ChevronRight className="h-4 w-4 ml-1" />
                                        </Button>
                                    ) : (
                                        <Button type="button" onClick={form.handleSubmit(onSubmit)} disabled={isPending}>
                                            {isPending ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update Item' : 'Create Item')}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export default ItemCreationWizard
